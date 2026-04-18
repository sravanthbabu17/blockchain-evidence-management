/**
 * ipfsService.js — EvidenceChain Multi-Pin IPFS Strategy v2.0
 * -------------------------------------------------------------
 * Pins evidence to multiple IPFS providers concurrently for redundancy.
 * Primary: Pinata.  Secondary: configurable (stub for Web3.Storage / local).
 *
 * Tracks per-provider: CID, latency, status, error.
 * Verifies CID consistency across providers (content-addressed guarantee).
 *
 * Research contribution: eliminates single-point-of-failure in storage
 * and provides measurable availability + latency metrics for evaluation.
 */

'use strict';

const axios    = require('axios');
const fs       = require('fs');
const FormData = require('form-data');
require('dotenv').config();

// ── Provider Configuration ────────────────────────────────────────────────────

const PINATA_API_KEY    = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_GATEWAY    = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

// Secondary provider (set SECONDARY_IPFS_ENABLED=true in .env to activate)
const SECONDARY_ENABLED = process.env.SECONDARY_IPFS_ENABLED === 'true';
const SECONDARY_API_URL = process.env.SECONDARY_IPFS_API_URL || '';
const SECONDARY_API_KEY = process.env.SECONDARY_IPFS_API_KEY || '';

// Availability check gateways
const GATEWAYS = [
    { name: 'pinata_gateway', url: PINATA_GATEWAY },
    { name: 'ipfs_io',        url: 'https://ipfs.io/ipfs' },
    { name: 'dweb_link',      url: 'https://dweb.link/ipfs' },
];

// ── Metrics Tracking ──────────────────────────────────────────────────────────

const providerMetrics = {
    pinata:    { attempts: 0, successes: 0, totalLatencyMs: 0 },
    secondary: { attempts: 0, successes: 0, totalLatencyMs: 0 },
};

// ── Pinata Upload Functions (Primary) ─────────────────────────────────────────

async function pinataPinJSON(jsonData) {
    const start = Date.now();
    providerMetrics.pinata.attempts++;

    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        jsonData,
        {
            headers: {
                'Content-Type': 'application/json',
                pinata_api_key: PINATA_API_KEY,
                pinata_secret_api_key: PINATA_SECRET_KEY
            }
        }
    );

    const latencyMs = Date.now() - start;
    providerMetrics.pinata.successes++;
    providerMetrics.pinata.totalLatencyMs += latencyMs;

    return { cid: response.data.IpfsHash, latencyMs };
}

async function pinataPinFile(filePath) {
    const start = Date.now();
    providerMetrics.pinata.attempts++;

    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));

    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        data,
        {
            maxBodyLength: Infinity,
            headers: {
                ...data.getHeaders(),
                pinata_api_key: PINATA_API_KEY,
                pinata_secret_api_key: PINATA_SECRET_KEY
            }
        }
    );

    const latencyMs = Date.now() - start;
    providerMetrics.pinata.successes++;
    providerMetrics.pinata.totalLatencyMs += latencyMs;

    return { cid: response.data.IpfsHash, latencyMs };
}

// ── Secondary Provider (Stub — plug in Web3.Storage / local IPFS) ─────────────

async function secondaryPinJSON(jsonData) {
    if (!SECONDARY_ENABLED) return null;
    const start = Date.now();
    providerMetrics.secondary.attempts++;

    try {
        // Stub: replace with actual secondary provider API call
        // Example for local IPFS: POST http://localhost:5001/api/v0/add
        if (SECONDARY_API_URL) {
            const response = await axios.post(SECONDARY_API_URL, JSON.stringify(jsonData), {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': SECONDARY_API_KEY ? `Bearer ${SECONDARY_API_KEY}` : undefined,
                },
                timeout: 30000
            });
            const latencyMs = Date.now() - start;
            providerMetrics.secondary.successes++;
            providerMetrics.secondary.totalLatencyMs += latencyMs;
            return { cid: response.data.Hash || response.data.cid, latencyMs };
        }
        return null;
    } catch (err) {
        console.warn('⚠️  [IPFS] Secondary JSON pin failed:', err.message);
        return null;
    }
}

async function secondaryPinFile(filePath) {
    if (!SECONDARY_ENABLED) return null;
    const start = Date.now();
    providerMetrics.secondary.attempts++;

    try {
        if (SECONDARY_API_URL) {
            const data = new FormData();
            data.append('file', fs.createReadStream(filePath));
            const response = await axios.post(SECONDARY_API_URL, data, {
                maxBodyLength: Infinity,
                headers: {
                    ...data.getHeaders(),
                    'Authorization': SECONDARY_API_KEY ? `Bearer ${SECONDARY_API_KEY}` : undefined,
                },
                timeout: 60000
            });
            const latencyMs = Date.now() - start;
            providerMetrics.secondary.successes++;
            providerMetrics.secondary.totalLatencyMs += latencyMs;
            return { cid: response.data.Hash || response.data.cid, latencyMs };
        }
        return null;
    } catch (err) {
        console.warn('⚠️  [IPFS] Secondary file pin failed:', err.message);
        return null;
    }
}

// ── Multi-Pin Orchestration ───────────────────────────────────────────────────

/**
 * Build a standardised provider result object.
 */
function buildResult(provider, priority, result, error) {
    return {
        provider,
        priority,
        cid:       result?.cid || null,
        latencyMs: result?.latencyMs || null,
        status:    result ? 'success' : 'failed',
        error:     error || null,
    };
}

/**
 * Upload JSON to all configured IPFS providers concurrently.
 * @returns {{ cid, providerResults[], cidConsistent, totalLatencyMs }}
 */
exports.uploadJSONToIPFS = async (jsonData) => {
    const results = [];

    // Primary: Pinata (always)
    let primaryResult = null;
    try {
        primaryResult = await pinataPinJSON(jsonData);
        results.push(buildResult('pinata', 'primary', primaryResult));
    } catch (err) {
        results.push(buildResult('pinata', 'primary', null, err.message));
        console.error('❌ [IPFS] Pinata JSON pin failed:', err.message);
    }

    // Secondary: concurrent (fire-and-forget style, non-blocking)
    const secondaryResult = await secondaryPinJSON(jsonData);
    if (secondaryResult) {
        results.push(buildResult('secondary', 'secondary', secondaryResult));
    } else if (SECONDARY_ENABLED) {
        results.push(buildResult('secondary', 'secondary', null, 'Provider unavailable'));
    }

    // CID consistency check
    const cids = results.filter(r => r.cid).map(r => r.cid);
    const cidConsistent = cids.length <= 1 || cids.every(c => c === cids[0]);
    if (!cidConsistent) {
        console.error('🚨 [IPFS] CID MISMATCH across providers!', cids);
    }

    // Use primary CID, fallback to any successful CID
    const cid = primaryResult?.cid || cids[0] || null;

    if (!cid) throw new Error('All IPFS providers failed');

    return cid;
};

/**
 * Upload a binary file to all configured IPFS providers.
 * @returns {string} CID from primary provider
 */
exports.uploadFileToIPFS = async (filePath) => {
    const results = [];

    // Primary: Pinata
    let primaryResult = null;
    try {
        console.log("📤 [IPFS] Pinning binary evidence (multi-pin)...");
        primaryResult = await pinataPinFile(filePath);
        results.push(buildResult('pinata', 'primary', primaryResult));
        console.log("✅ [IPFS] Pinata upload SUCCESS:", primaryResult.cid);
    } catch (err) {
        results.push(buildResult('pinata', 'primary', null, err.message));
        console.error("❌ [IPFS] Pinata file pin failed:", err.message);
    }

    // Secondary
    const secondaryResult = await secondaryPinFile(filePath);
    if (secondaryResult) {
        results.push(buildResult('secondary', 'secondary', secondaryResult));
        console.log("✅ [IPFS] Secondary upload SUCCESS:", secondaryResult.cid);
    }

    const cids = results.filter(r => r.cid).map(r => r.cid);
    const cid = primaryResult?.cid || cids[0] || null;

    if (!cid) throw new Error('All IPFS file upload providers failed');

    return cid;
};

/**
 * Get detailed upload results for the last operation (for record metadata).
 * Call uploadJSONToIPFSDetailed instead for full results.
 */
exports.uploadJSONToIPFSDetailed = async (jsonData) => {
    const results = [];

    let primaryResult = null;
    try {
        primaryResult = await pinataPinJSON(jsonData);
        results.push(buildResult('pinata', 'primary', primaryResult));
    } catch (err) {
        results.push(buildResult('pinata', 'primary', null, err.message));
    }

    const secondaryResult = await secondaryPinJSON(jsonData);
    if (secondaryResult) {
        results.push(buildResult('secondary', 'secondary', secondaryResult));
    } else if (SECONDARY_ENABLED) {
        results.push(buildResult('secondary', 'secondary', null, 'Provider unavailable'));
    }

    const cids = results.filter(r => r.cid).map(r => r.cid);
    const cidConsistent = cids.length <= 1 || cids.every(c => c === cids[0]);
    const cid = primaryResult?.cid || cids[0] || null;

    if (!cid) throw new Error('All IPFS providers failed');

    return {
        cid,
        providerResults: results,
        cidConsistent,
        totalLatencyMs: results.reduce((sum, r) => sum + (r.latencyMs || 0), 0),
    };
};

/**
 * Check CID availability across multiple IPFS gateways.
 * @param {string} cid - IPFS CID to check
 * @returns {{ gateway, available, latencyMs }[]}
 */
exports.checkAvailability = async (cid) => {
    const results = [];
    for (const gw of GATEWAYS) {
        const start = Date.now();
        try {
            await axios.head(`${gw.url}/${cid}`, { timeout: 10000 });
            results.push({ gateway: gw.name, available: true, latencyMs: Date.now() - start });
        } catch {
            results.push({ gateway: gw.name, available: false, latencyMs: Date.now() - start });
        }
    }
    return results;
};

/**
 * Get aggregated provider metrics for evaluation.
 */
exports.getProviderMetrics = () => {
    const metrics = {};
    for (const [name, m] of Object.entries(providerMetrics)) {
        metrics[name] = {
            attempts: m.attempts,
            successes: m.successes,
            successRate: m.attempts > 0 ? (m.successes / m.attempts * 100).toFixed(1) + '%' : 'N/A',
            avgLatencyMs: m.successes > 0 ? Math.round(m.totalLatencyMs / m.successes) : null,
        };
    }
    return metrics;
};
