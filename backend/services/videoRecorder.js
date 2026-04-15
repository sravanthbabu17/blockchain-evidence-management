/**
 * videoRecorder.js — EvidenceChain Dashcam Ring-Buffer Service
 * ------------------------------------------------------------
 * Maintains a continuous MPEG-TS ring-buffer from the system camera.
 * This enables forensic extraction of pre- and post-collision footage
 * by the forensicService without any human interaction.
 *
 * Camera priority (tried in order):
 *   1. Named camera device (DirectShow on Windows / V4L2 on Linux)
 *   2. Any available camera (auto-detect)
 *   3. Software test pattern (lavfi testsrc) — EXPLICITLY flagged as simulation
 *
 * The current recording mode is always exposed via `getStatus()` so that:
 *   - The backend API can report it to the dashboard (camera indicator)
 *   - The research paper can accurately disclose whether hardware or
 *     simulated footage was used in each experiment.
 *
 * Research disclosure:
 *   When CAMERA_MODE === 'simulation', recorded video is a colour-bar test
 *   pattern and NOT real dashcam footage.  This must be disclosed in the
 *   paper's experimental setup section.
 */

'use strict';

const { spawn } = require('child_process');
const fs        = require('path');
const fse       = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────

const OUTPUT_PATH = fs.join(__dirname, '../recording.ts');

// Platform-specific camera device name.
// On Windows (DirectShow): "video=<device name>"
// On Linux (V4L2):         "/dev/video0"
//
// The value is read from the environment so it can be changed without
// re-deploying code. Default targets the most common Windows laptop camera.
const CAMERA_DEVICE = process.env.CAMERA_DEVICE || 'video=Integrated Camera';

// ── State ─────────────────────────────────────────────────────────────────────

let ffmpegProcess  = null;
let usingFallback  = false;
let recordingStart = null;
let frameCount     = 0;

// 'hardware' | 'simulation' | 'stopped'
let CAMERA_MODE = 'stopped';

// ── FFmpeg argument sets ───────────────────────────────────────────────────────

/**
 * Build DirectShow (Windows) or V4L2 (Linux) camera capture args.
 */
function _buildCameraArgs() {
    if (process.platform === 'win32') {
        return ['-f', 'dshow', '-i', CAMERA_DEVICE];
    } else {
        // Linux / Raspberry Pi
        const device = process.env.CAMERA_DEVICE || '/dev/video0';
        return ['-f', 'v4l2', '-input_format', 'mjpeg', '-i', device];
    }
}

/**
 * Software fallback — generates a colour-bar + timestamp test pattern.
 * Used when no camera hardware is available.
 */
const FALLBACK_ARGS = [
    '-f',   'lavfi',
    '-i',   'testsrc=size=1280x720:rate=15',
    '-vf',  "drawtext=text='SIMULATION MODE - NOT REAL DASHCAM':x=10:y=10:fontcolor=red:fontsize=28"
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the ring-buffer recording.
 * Attempts real camera first; auto-falls back to simulation if unavailable.
 *
 * @param {boolean} [forceFallback=false]  Force simulation mode immediately.
 */
function startRecording(forceFallback = false) {
    if (ffmpegProcess) {
        console.log('📷 [VideoRecorder] Already recording — skip duplicate start.');
        return;
    }

    usingFallback = forceFallback;
    const sourceArgs = forceFallback ? FALLBACK_ARGS : _buildCameraArgs();
    const label      = forceFallback ? '🔁 SIMULATION (testsrc)' : `📷 Camera [${CAMERA_DEVICE}]`;

    console.log(`\n🎥 [VideoRecorder] Starting ring-buffer recording → ${label}`);
    console.log(`   Output : ${OUTPUT_PATH}`);

    CAMERA_MODE    = forceFallback ? 'simulation' : 'hardware';
    recordingStart = Date.now();

    let ioErrorDetected = false;

    ffmpegProcess = spawn('ffmpeg', [
        ...sourceArgs,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune',   'zerolatency',
        '-f',      'mpegts',
        '-y',
        OUTPUT_PATH
    ]);

    // Stream stderr to console (FFmpeg logs its progress here)
    ffmpegProcess.stderr.on('data', (data) => {
        const msg = data.toString();

        // Count frames for throughput metric
        const match = msg.match(/frame=\s*(\d+)/);
        if (match) frameCount = parseInt(match[1], 10);

        // Detect camera access failures
        if (!forceFallback && (
            msg.includes('I/O error') ||
            msg.includes('unable to open device') ||
            msg.includes('could not open') ||
            msg.includes('No such file or directory')
        )) {
            ioErrorDetected = true;
            console.warn('⚠️  [VideoRecorder] Camera unavailable. Falling back to simulation mode.');
            console.warn('   Tip: Close any app using the camera (Teams, Zoom, Windows Camera).');
        } else if (msg.includes('Error') && !msg.includes('Error while decoding')) {
            console.error(`❌ [VideoRecorder] FFmpeg: ${msg.trim().substring(0, 200)}`);
        }
    });

    ffmpegProcess.on('close', (code) => {
        ffmpegProcess  = null;
        CAMERA_MODE    = 'stopped';
        recordingStart = null;

        if (ioErrorDetected) {
            // Camera was locked — switch to simulation
            console.log('🔄 [VideoRecorder] Camera locked → switching to simulation in 1 s...');
            setTimeout(() => startRecording(true), 1000);
        } else if (!forceFallback && code !== 0 && code !== null) {
            // Camera crashed — retry real camera after delay
            console.log(`🔄 [VideoRecorder] Camera crash (code ${code}) → retrying in 10 s...`);
            setTimeout(() => startRecording(false), 10_000);
        } else if (forceFallback) {
            // Simulation exited normally — keep it running
            console.log('🔄 [VideoRecorder] Simulation ended → restarting in 5 s...');
            setTimeout(() => startRecording(true), 5_000);
        }
    });

    ffmpegProcess.on('error', (err) => {
        console.error('❌ [VideoRecorder] FFmpeg spawn error:', err.message);
        console.error('   Ensure FFmpeg is installed and on PATH.');
        ffmpegProcess = null;
        CAMERA_MODE   = 'stopped';
    });
}

/**
 * Stop recording cleanly.
 */
function stopRecording() {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM');
        ffmpegProcess  = null;
        CAMERA_MODE    = 'stopped';
        recordingStart = null;
        console.log('⏹️  [VideoRecorder] Recording stopped.');
    }
}

/**
 * Return current recording status — exposed via the /api/camera/status endpoint.
 * Used by the dashboard camera health indicator and disclosed in the paper.
 *
 * @returns {{
 *   mode: 'hardware'|'simulation'|'stopped',
 *   cameraDevice: string,
 *   bufferExists: boolean,
 *   bufferSizeBytes: number|null,
 *   uptimeMs: number|null,
 *   frameCount: number,
 *   isRealHardware: boolean
 * }}
 */
function getStatus() {
    let bufferSizeBytes = null;
    try {
        if (fse.existsSync(OUTPUT_PATH)) {
            bufferSizeBytes = fse.statSync(OUTPUT_PATH).size;
        }
    } catch (_) {}

    return {
        mode:           CAMERA_MODE,
        cameraDevice:   CAMERA_DEVICE,
        bufferExists:   fse.existsSync(OUTPUT_PATH),
        bufferSizeBytes,
        uptimeMs:       recordingStart ? Date.now() - recordingStart : null,
        frameCount,
        isRealHardware: CAMERA_MODE === 'hardware',
        note: CAMERA_MODE === 'simulation'
            ? 'SIMULATION MODE active — test pattern only, not real dashcam footage.'
            : (CAMERA_MODE === 'hardware'
                ? 'Real camera hardware active.'
                : 'Recording stopped.')
    };
}

module.exports = { startRecording, stopRecording, getStatus };
