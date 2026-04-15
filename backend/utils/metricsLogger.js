/**
 * metricsLogger.js — EvidenceChain Pipeline Latency Tracker
 * ----------------------------------------------------------
 * Records per-stage high-resolution timestamps for every forensic case.
 * These measurements underpin the performance evaluation section of the
 * research paper (end-to-end latency, IPFS upload time, blockchain
 * confirmation time, SHA-256 computation time).
 *
 * Usage:
 *   const metrics = require('./metricsLogger');
 *   const timer = metrics.startTrace(recordId);
 *   // ... do work ...
 *   timer.mark('ipfs_upload_start');
 *   // ... upload ...
 *   timer.mark('ipfs_upload_end');
 *   timer.finalise();
 *
 * Retrieve summary:
 *   metrics.getSummary()   → aggregated stats across all traces
 *   metrics.getTrace(id)   → raw marks for one record
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// Persist metrics to disk so they survive server restarts
const METRICS_FILE = path.join(__dirname, '../data/metrics.json');

/** @type {Map<string, object>} In-memory store keyed by recordId */
const traces = new Map();

// Load any previously persisted metrics on startup
try {
    if (fs.existsSync(METRICS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
        raw.forEach(t => traces.set(t.recordId, t));
        console.log(`📊 [Metrics] Loaded ${traces.size} historical traces.`);
    }
} catch (_) { /* non-fatal */ }

/**
 * Persist current traces to disk (non-blocking fire-and-forget).
 */
function _persist() {
    try {
        const dir = path.dirname(METRICS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(METRICS_FILE, JSON.stringify([...traces.values()], null, 2));
    } catch (e) {
        console.warn('⚠️  [Metrics] Persist failed:', e.message);
    }
}

/**
 * Start a new latency trace for a forensic case.
 * @param {string} recordId - Unique case ID
 * @returns {{ mark(stage: string): void, finalise(): object }}
 */
exports.startTrace = (recordId) => {
    const trace = {
        recordId,
        startedAt: Date.now(),
        marks:     {},
        durations: {},
        finalised: false
    };
    traces.set(recordId, trace);

    return {
        /**
         * Record a named milestone timestamp.
         * @param {string} stage - e.g. 'hash_start', 'ipfs_upload_end'
         */
        mark(stage) {
            trace.marks[stage] = Date.now();
            console.log(`📊 [Metrics][${recordId}] ● ${stage} @ +${Date.now() - trace.startedAt}ms`);
        },

        /**
         * Calculate derived durations and seal the trace.
         * @returns {object} Finalised trace object
         */
        finalise() {
            if (trace.finalised) return trace;

            const m = trace.marks;

            // Derived durations (ms) — only computed if both marks exist
            const dur = (a, b) => (m[a] !== undefined && m[b] !== undefined)
                ? m[b] - m[a]
                : null;

            trace.durations = {
                sha256_ms:           dur('hash_start',            'hash_end'),
                ipfs_json_ms:        dur('ipfs_json_start',       'ipfs_json_end'),
                blockchain_ms:       dur('blockchain_start',      'blockchain_end'),
                ipfs_video_ms:       dur('ipfs_video_start',      'ipfs_video_end'),
                total_pipeline_ms:   (m['blockchain_end'] !== undefined)
                    ? m['blockchain_end'] - trace.startedAt
                    : null,
                video_capture_ms:    dur('video_capture_start',   'video_capture_end'),
            };

            trace.finalised  = true;
            trace.finalisedAt = Date.now();

            console.log(`📊 [Metrics][${recordId}] ✅ Trace finalised:`, trace.durations);
            _persist();
            return trace;
        }
    };
};

/**
 * Retrieve the raw trace for a single record.
 * @param {string} recordId
 */
exports.getTrace = (recordId) => traces.get(recordId) || null;

/**
 * Return aggregated statistics across all finalised traces.
 * Suitable for formatting into a research paper results table.
 */
exports.getSummary = () => {
    const finalised = [...traces.values()].filter(t => t.finalised);
    if (finalised.length === 0) return { count: 0, note: 'No finalised traces yet' };

    const fields = [
        'sha256_ms', 'ipfs_json_ms', 'blockchain_ms',
        'ipfs_video_ms', 'total_pipeline_ms', 'video_capture_ms'
    ];

    const summary = { count: finalised.length, fields: {} };

    fields.forEach(f => {
        const vals = finalised
            .map(t => t.durations[f])
            .filter(v => v !== null && !isNaN(v));

        if (vals.length === 0) { summary.fields[f] = null; return; }

        const sorted = [...vals].sort((a, b) => a - b);
        const mean   = vals.reduce((s, v) => s + v, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;

        summary.fields[f] = {
            n:       vals.length,
            min_ms:  sorted[0],
            max_ms:  sorted[sorted.length - 1],
            mean_ms: parseFloat(mean.toFixed(2)),
            std_ms:  parseFloat(Math.sqrt(variance).toFixed(2)),
            p50_ms:  sorted[Math.floor(vals.length * 0.50)],
            p95_ms:  sorted[Math.floor(vals.length * 0.95)] ?? sorted[sorted.length - 1],
        };
    });

    return summary;
};

/**
 * Return all traces (raw) — useful for exporting to CSV for the paper.
 */
exports.getAllTraces = () => [...traces.values()];
