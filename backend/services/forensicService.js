/**
 * forensicService.js — EvidenceChain Autonomous Video Forensics
 * -------------------------------------------------------------
 * Triggered automatically after a collision event is recorded.
 * Pipeline:
 *   1. Extract 30 s BEFORE segment from the ring-buffer dashcam feed
 *   2. Wait 30 s for the post-impact segment to accumulate
 *   3. Extract 30 s AFTER segment
 *   4. Merge → single 60 s forensic MP4
 *   5. SHA-256 hash of the video file
 *   6. Upload video to IPFS via Pinata
 *   7. Anchor (videoCID + videoHash) on Ethereum
 *   8. Update the accident record with video metadata + latency metrics
 *
 * Research integrity:
 *   - NEVER anchor a fake CID when IPFS fails.
 *   - NEVER store a mock TX hash.
 *   - All failures are logged and recorded with explicit `videoStatus` flags.
 *
 * Camera note:
 *   The system uses a continuously-running FFmpeg ring-buffer (recording.ts)
 *   fed by the system camera (DirectShow on Windows, V4L2 on Linux).
 *   The videoRecorder service manages that buffer; this service only reads it.
 */

'use strict';

const { exec }  = require('child_process');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const ipfsService       = require('./ipfsService');
const blockchainService = require('./blockchainService');
const accidentService   = require('./accidentService');
const metricsLogger     = require('../utils/metricsLogger');

let isProcessing = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

const execAsync = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stderr }));
        else resolve({ stdout, stderr });
    });
});

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Trigger the forensic video capture pipeline asynchronously.
 * Safe to call fire-and-forget; uses a processing lock to prevent duplicates.
 *
 * @param {string} recordId   - The accident record ID to enrich
 * @param {string} vehicleId  - Vehicle identifier (for logging)
 * @param {string} timestamp  - ISO 8601 collision timestamp
 */
exports.triggerForensicCapture = (recordId, vehicleId, timestamp) => {
    if (isProcessing) {
        console.warn('⚠️  [ForensicService] Capture already in progress — skipping duplicate trigger.');
        return;
    }
    isProcessing = true;

    // Run asynchronously so we never block the HTTP response to the sensor
    _runPipeline(recordId, vehicleId, timestamp)
        .catch(err => console.error('❌ [ForensicService] Pipeline error:', err.message))
        .finally(() => { isProcessing = false; });
};

// ── Internal Pipeline ─────────────────────────────────────────────────────────

async function _runPipeline(recordId, vehicleId, timestamp) {
    const timer = metricsLogger.startTrace(`video-${recordId}`);

    const videoDir     = path.join(__dirname, '../videos');
    const recordingFile = path.join(__dirname, '../recording.ts');
    const beforeFile   = path.join(videoDir, `${recordId}_before.mp4`);
    const afterFile    = path.join(videoDir, `${recordId}_after.mp4`);
    const finalFile    = path.join(videoDir, `${recordId}_final.mp4`);
    const listFile     = path.join(videoDir, `${recordId}_list.txt`);

    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    // ── Verify recording buffer exists ────────────────────────────────────────
    if (!fs.existsSync(recordingFile)) {
        console.error('❌ [ForensicService] recording.ts not found — camera buffer unavailable.');
        _markVideoFailed(recordId, 'no_camera_buffer');
        return;
    }

    // ── Small write-flush lag ─────────────────────────────────────────────────
    await _sleep(2000);

    // ── Step 1 : Extract BEFORE segment (last 30 s of ring buffer) ───────────
    timer.mark('video_capture_start');
    console.log('🎥 [ForensicService] Extracting BEFORE segment (−30 s)...');
    try {
        await execAsync(`ffmpeg -sseof -30 -i "${recordingFile}" -t 30 -c copy -y "${beforeFile}"`);
    } catch (err) {
        console.error('❌ [ForensicService] BEFORE extraction failed:', err.message);
        _markVideoFailed(recordId, 'ffmpeg_before_failed');
        return;
    }

    // ── Step 2 : Wait 30 s to capture post-impact footage ────────────────────
    console.log('⏳ [ForensicService] Waiting 30 s for AFTER segment...');
    await _sleep(30_000);

    // ── Step 3 : Extract AFTER segment ───────────────────────────────────────
    console.log('🎥 [ForensicService] Extracting AFTER segment (+30 s)...');
    try {
        await execAsync(`ffmpeg -sseof -30 -i "${recordingFile}" -t 30 -c copy -y "${afterFile}"`);
    } catch (err) {
        console.error('❌ [ForensicService] AFTER extraction failed:', err.message);
        _markVideoFailed(recordId, 'ffmpeg_after_failed');
        return;
    }

    // ── Step 4 : Merge BEFORE + AFTER into one forensic package ──────────────
    console.log('🔗 [ForensicService] Merging segments into 60 s forensic video...');
    const listContent = `file '${recordId}_before.mp4'\nfile '${recordId}_after.mp4'`;
    fs.writeFileSync(listFile, listContent);

    try {
        await execAsync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy -y "${finalFile}"`);
    } catch (err) {
        console.error('❌ [ForensicService] Merge failed:', err.message);
        _markVideoFailed(recordId, 'ffmpeg_merge_failed');
        return;
    }

    timer.mark('video_capture_end');
    console.log('✅ [ForensicService] Forensic video package assembled.');

    // ── Step 5 : SHA-256 hash of the video ────────────────────────────────────
    const fileBuffer = fs.readFileSync(finalFile);
    const videoHash  = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`🔒 [ForensicService] Video SHA-256: ${videoHash}`);

    // ── Step 6 : Upload video to IPFS ────────────────────────────────────────
    let videoCid      = null;
    let videoIpfsStatus = 'pending';

    timer.mark('ipfs_video_start');
    try {
        videoCid = await ipfsService.uploadFileToIPFS(finalFile);
        videoIpfsStatus = 'success';
        console.log(`📤 [ForensicService] Video IPFS CID: ${videoCid}`);
    } catch (e) {
        videoIpfsStatus = 'failed';
        videoCid = null;   // ← Never use a fake CID
        console.error('❌ [ForensicService] IPFS video upload failed:', e.message);
    }
    timer.mark('ipfs_video_end');

    // ── Step 7 : Blockchain anchor (only for real IPFS CID) ──────────────────
    let videoTxHash         = null;
    let videoBlockchainStatus = 'skipped_no_cid';
    let videoAnchorMeta     = null;

    if (videoCid) {
        try {
            videoAnchorMeta        = await blockchainService.storeOnBlockchain({
                cid:       videoCid,
                hash:      videoHash,
                vehicleId,
                timestamp
            });
            videoTxHash            = videoAnchorMeta.txHash;
            videoBlockchainStatus  = 'confirmed';
            console.log(`⚓ [ForensicService] Video TX: ${videoTxHash}`);
        } catch (e) {
            videoBlockchainStatus = 'failed';
            videoTxHash           = null;   // ← Never fabricate a mock TX hash
            console.error('❌ [ForensicService] Video blockchain anchor failed:', e.message);
        }
    } else {
        console.warn('⚠️  [ForensicService] Skipping chain anchor — no real video CID available.');
    }

    // ── Step 8 : Update accident record ──────────────────────────────────────
    const records = accidentService.getAllRecords();
    const record  = records.find(r => r.id === recordId);

    if (record) {
        record.video = {
            local:          `videos/${recordId}_final.mp4`,
            localPath:      `videos/${recordId}_final.mp4`,
            cid:            videoCid,          // null if IPFS failed (honest)
            hash:           videoHash,
            txHash:         videoTxHash,       // null if chain failed (honest)
            ipfsStatus:     videoIpfsStatus,
            blockchainStatus: videoBlockchainStatus,
            gasUsed:        videoAnchorMeta?.gasUsed    ?? null,
            blockNumber:    videoAnchorMeta?.blockNumber ?? null,
            confirmationMs: videoAnchorMeta?.confirmationMs ?? null,
            anchoredAt:     new Date().toISOString()
        };

        record.timeline.push({
            action: 'Forensic Video Assembled (60 s Window)',
            by:     'VideoRecorder (Autonomous)',
            time:   new Date().toISOString(),
            detail: {
                videoIpfsStatus,
                videoBlockchainStatus,
                videoHash: videoHash.slice(0, 16) + '...'
            }
        });

        accidentService.saveRecords();
        console.log(`🏆 [ForensicService] Record ${recordId} enriched with video evidence.`);
    } else {
        console.warn(`⚠️  [ForensicService] Record ${recordId} not found for update.`);
    }

    // ── Step 9 : Cleanup temp files ───────────────────────────────────────────
    [beforeFile, afterFile, listFile].forEach(f => {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    });

    timer.finalise();
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function _markVideoFailed(recordId, reason) {
    const records = accidentService.getAllRecords();
    const record  = records.find(r => r.id === recordId);
    if (record) {
        record.video = { cid: null, txHash: null, ipfsStatus: 'failed', blockchainStatus: 'skipped', failReason: reason };
        record.timeline.push({ action: 'Video Capture Failed', by: 'System', time: new Date().toISOString(), reason });
        accidentService.saveRecords();
    }
}
