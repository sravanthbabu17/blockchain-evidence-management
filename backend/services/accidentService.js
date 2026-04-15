/**
 * accidentService.js — EvidenceChain Forensic Processing Service
 * ---------------------------------------------------------------
 * Core forensic pipeline:
 *   1. Validate incoming sensor data
 *   2. SHA-256 hash of stable-sorted JSON payload
 *   3. Upload JSON evidence to IPFS (Pinata)
 *   4. Anchor hash + CID on Ethereum (Sepolia)
 *   5. Persist record with full latency metrics
 *   6. Trigger autonomous video capture (fire-and-forget)
 *
 * Research integrity rules (DO NOT remove):
 *   - NEVER anchor a fake/local CID on the blockchain.
 *   - NEVER store a mock transaction hash as a real one.
 *   - If IPFS or blockchain fails, the record is flagged but NOT fabricated.
 */

'use strict';

const { generateHash }  = require('../utils/hashUtil');
const { uploadJSONToIPFS } = require('./ipfsService');
const { storeOnBlockchain } = require('./blockchainService');
const metricsLogger     = require('../utils/metricsLogger');
const fs   = require('fs');
const path = require('path');

// Lazy-load to avoid circular dependency with forensicService
let forensicService = null;
const getForensicService = () => {
    if (!forensicService) forensicService = require('./forensicService');
    return forensicService;
};

// ── Persistence ──────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, '../data/records.json');
let records = [];

try {
    if (fs.existsSync(DATA_FILE)) {
        records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log(`💾 [AccidentService] Loaded ${records.length} persisted records.`);
    }
} catch (err) {
    console.error('❌ [AccidentService] Failed to load persisted data:', err.message);
    records = [];
}

const saveToFile = () => {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
    } catch (err) {
        console.error('❌ [AccidentService] Persistence error:', err.message);
    }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively sort object keys to ensure a deterministic JSON string for
 * cryptographic hashing — a requirement for reproducible verification.
 */
const stableSort = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(stableSort);
    const result = {};
    Object.keys(obj).sort().forEach(k => { result[k] = stableSort(obj[k]); });
    return result;
};

/**
 * Validate GPS coordinates before anchoring.
 * Returns false for the (0.0, 0.0) Gulf-of-Guinea fallback.
 */
const isValidGPS = (gps) => {
    if (!gps || typeof gps.lat !== 'number' || typeof gps.lon !== 'number') return false;
    if (gps.lat === 0.0 && gps.lon === 0.0) return false;
    return true;
};

// ── Core Processing ───────────────────────────────────────────────────────────

/**
 * Process an incoming accident sensor report.
 * @param {object} data  Raw ESP32 / simulator payload
 * @returns {object}     Finalised forensic record
 */
exports.processAccidentData = async (data) => {
    const pipelineStart = Date.now();

    if (!data || !data.vehicle_id) {
        throw new Error('Invalid accident record: Missing vehicle_id');
    }

    const recordId  = Date.now().toString();
    const timestamp = data.timestamp || new Date().toISOString();
    const timer     = metricsLogger.startTrace(recordId);

    console.log(`\n⚡ [AccidentService] Processing case ${recordId} for ${data.vehicle_id}`);

    // ── 1. GPS validation ────────────────────────────────────────────────────
    const gpsValid = isValidGPS(data.gps);
    if (!gpsValid) {
        console.warn('⚠️  [AccidentService] GPS coordinates invalid or (0,0) fallback — flagging record.');
    }

    // ── 2. Build evidence payload ────────────────────────────────────────────
    const evidenceData = {
        ...data,
        gps_valid: gpsValid,      // Explicitly flag GPS quality for verifiers
        pipeline_start_iso: new Date(pipelineStart).toISOString()
    };

    // ── 3. Stable cryptographic hash ─────────────────────────────────────────
    timer.mark('hash_start');
    const sortedEvidence = stableSort(evidenceData);
    const hash = generateHash(JSON.stringify(sortedEvidence));
    timer.mark('hash_end');
    console.log(`🔒 [AccidentService] SHA-256: ${hash}`);

    // ── 4. IPFS Upload (JSON metadata) ───────────────────────────────────────
    let cid = null;
    let ipfsStatus = 'success';

    timer.mark('ipfs_json_start');
    try {
        cid = await uploadJSONToIPFS(evidenceData);
        timer.mark('ipfs_json_end');
        console.log(`📤 [AccidentService] IPFS JSON CID: ${cid}`);
    } catch (e) {
        timer.mark('ipfs_json_end');
        ipfsStatus = 'failed';
        cid = null;   // ← NEVER fabricate a local-XXXX CID
        console.error('❌ [AccidentService] IPFS upload failed:', e.message);
    }

    // ── 5. Blockchain Anchoring ───────────────────────────────────────────────
    let txHash = null;
    let blockchainStatus = 'skipped';

    if (cid) {
        // Only anchor when we have a REAL IPFS CID
        timer.mark('blockchain_start');
        blockchainStatus = 'pending';
        try {
            txHash = await storeOnBlockchain({ cid, hash, vehicleId: data.vehicle_id, timestamp });
            timer.mark('blockchain_end');
            blockchainStatus = 'confirmed';
            console.log(`⚓ [AccidentService] Blockchain TX: ${txHash}`);
        } catch (e) {
            timer.mark('blockchain_end');
            blockchainStatus = 'failed';
            txHash = null;   // ← NEVER fabricate a mock 0x-mock-tx hash
            console.error('❌ [AccidentService] Blockchain anchor failed:', e.message);
        }
    } else {
        console.warn('⚠️  [AccidentService] Skipping blockchain anchor — no real IPFS CID available.');
        blockchainStatus = 'skipped_no_cid';
    }

    // ── 6. Build Forensic Record ──────────────────────────────────────────────
    const finalRecord = {
        id:        recordId,
        vehicle_id: data.vehicle_id,

        // Evidence integrity
        hash,
        cid:       cid  || null,
        txHash:    txHash || null,

        // Explicit storage status flags (never hide failures)
        ipfsStatus,
        blockchainStatus,
        gpsValid,

        timestamp,
        evidenceData,
        verifiedAt: null,

        // Workflow fields
        status:     'pending',
        assigned:   false,
        assignedTo: null,

        // Forensic audit timeline
        timeline: [{
            action: 'Case Created',
            by:     'System (Forensic Enclave)',
            time:   new Date().toISOString(),
            stages: { ipfsStatus, blockchainStatus }
        }],

        // Latency metrics (populated after finalise())
        metrics: null
    };

    records.push(finalRecord);
    saveToFile();

    // ── 7. Finalise latency trace ─────────────────────────────────────────────
    const traceResult = timer.finalise();
    finalRecord.metrics = traceResult.durations;
    saveToFile(); // Save again with metrics

    console.log(`📦 [AccidentService] Case ${recordId} secured. IPFS:${ipfsStatus} Chain:${blockchainStatus}`);

    // ── 8. Trigger forensic video capture (fire-and-forget) ─────────────────
    if (data.impact === true) {
        console.log('💥 [AccidentService] Impact flag → triggering autonomous video capture...');
        setImmediate(() => {
            getForensicService().triggerForensicCapture(recordId, data.vehicle_id, timestamp);
        });
    }

    return finalRecord;
};

// ── CRUD helpers ──────────────────────────────────────────────────────────────

exports.getAllRecords = () => records;

exports.assignCase = (id, investigator) => {
    const record = records.find(r => r.id === id);
    if (!record) throw new Error('Case not found');
    record.status     = 'assigned';
    record.assigned   = true;
    record.assignedTo = investigator || 'Investigator_1';
    saveToFile();
    return record;
};

exports.updateStatus = (id, status) => {
    const record = records.find(r => r.id === id);
    if (!record) throw new Error('Case not found');
    record.status = status;
    saveToFile();
    return record;
};

exports.saveRecords = saveToFile;