/**
 * app.js — EvidenceChain API Server
 * ----------------------------------
 * Express application entry point.
 * Mounts all routes, starts the forensic ring-buffer camera recording,
 * and exposes the metrics/camera-status endpoints required by the
 * research paper's evaluation section.
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { startRecording, getStatus } = require('./services/videoRecorder');
const metricsLogger = require('./utils/metricsLogger');
const verifyFirebaseToken = require('./middleware/authMiddleware');
const { allowRoles } = require('./middleware/roleMiddleware');
const { corsOptions, securityHeaders, rateLimit } = require('./middleware/securityMiddleware');
const accidentService = require('./services/accidentService');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '128kb' }));
app.use('/api', rateLimit('api', process.env.API_RATE_LIMIT || 300));

// ── Ensure required directories exist ────────────────────────────────────────
['uploads/temp', 'uploads/chunks', 'videos', 'data'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── 🎥  Start continuous forensic recording ───────────────────────────────────
// Attempts real camera first; auto-falls back to simulation if unavailable.
// Camera device can be overridden via the CAMERA_DEVICE environment variable.
startRecording();

// ── Serve forensic video files to the dashboard ─────────────────────────────
const canReadRecord = (user, record) => {
    if (!user || !record) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'investigator' && record.assignedTo === user.email) return true;
    if (user.role === 'owner' && record.vehicle_id === user.vehicle_id) return true;
    return false;
};

// ── Mount application routes ──────────────────────────────────────────────────
const accidentRoutes = require('./routes/accidentRoutes');
const impactRoutes   = require('./routes/impactRoutes');
const verifyRoutes   = require('./routes/verifyRoutes');
const custodyRoutes  = require('./routes/custodyRoutes');

app.use('/api/accident', accidentRoutes);
app.use('/api',          rateLimit('impact', process.env.IMPACT_RATE_LIMIT || 20), impactRoutes);
app.use('/api/verify',   verifyRoutes);
app.use('/api/custody',  custodyRoutes);

app.get('/api/videos/:filename', verifyFirebaseToken, (req, res) => {
    const filename = path.basename(req.params.filename || '');
    if (!/^[A-Za-z0-9_.-]+\.mp4$/.test(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid video filename' });
    }

    const record = accidentService.getAllRecords().find(r => {
        const localPath = r.video?.local || r.video?.localPath || '';
        return path.basename(localPath) === filename;
    });

    if (!record) {
        return res.status(404).json({ success: false, message: 'Video evidence not found' });
    }
    if (!canReadRecord(req.user, record)) {
        return res.status(403).json({ success: false, message: 'Access denied for this video evidence' });
    }

    return res.sendFile(path.join(__dirname, 'videos', filename));
});

// ── Research Paper Evaluation Endpoints ──────────────────────────────────────

/**
 * GET /api/camera/status
 * Returns live camera recording state for the dashboard indicator and
 * for experimental disclosure in the research paper.
 */
app.get('/api/camera/status', verifyFirebaseToken, (req, res) => {
    res.json({ success: true, camera: getStatus() });
});

/**
 * GET /api/metrics
 * Returns aggregated pipeline latency statistics across all recorded cases.
 * Used directly to populate Table III ("Performance Evaluation") in the paper.
 *
 * Response includes: mean, std, min, max, p50, p95 for:
 *   - sha256_ms           (hash computation time)
 *   - ipfs_json_ms        (IPFS JSON metadata upload time)
 *   - blockchain_ms       (Ethereum TX confirmation time)
 *   - ipfs_video_ms       (IPFS video upload time)
 *   - video_capture_ms    (FFmpeg extraction + merge time)
 *   - total_pipeline_ms   (collision to blockchain confirmation)
 */
app.get('/api/metrics', verifyFirebaseToken, allowRoles('admin'), (req, res) => {
    const summary = metricsLogger.getSummary();
    res.json({ success: true, metrics: summary });
});

/**
 * GET /api/metrics/raw
 * Returns raw per-case trace data for CSV export / plotting.
 */
app.get('/api/metrics/raw', verifyFirebaseToken, allowRoles('admin'), (req, res) => {
    const traces = metricsLogger.getAllTraces();
    res.json({ success: true, count: traces.length, traces });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        system:  'EvidenceChain — Forensic Evidence API',
        status:  'active',
        camera:  getStatus().mode,
        version: '2.0.0'
    });
});

module.exports = app;
