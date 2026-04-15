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

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// ── Mount application routes ──────────────────────────────────────────────────
const accidentRoutes = require('./routes/accidentRoutes');
const impactRoutes   = require('./routes/impactRoutes');
const verifyRoutes   = require('./routes/verifyRoutes');

app.use('/api/accident', accidentRoutes);
app.use('/api',          impactRoutes);
app.use('/api/verify',   verifyRoutes);

// ── Research Paper Evaluation Endpoints ──────────────────────────────────────

/**
 * GET /api/camera/status
 * Returns live camera recording state for the dashboard indicator and
 * for experimental disclosure in the research paper.
 */
app.get('/api/camera/status', (req, res) => {
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
app.get('/api/metrics', (req, res) => {
    const summary = metricsLogger.getSummary();
    res.json({ success: true, metrics: summary });
});

/**
 * GET /api/metrics/raw
 * Returns raw per-case trace data for CSV export / plotting.
 */
app.get('/api/metrics/raw', (req, res) => {
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