/**
 * accidentService.js — EvidenceChain Forensic Processing Service v2.0
 * --------------------------------------------------------------------
 * Core forensic pipeline:
 *   1. Validate incoming sensor data
 *   2. SHA-256 hash of stable-sorted JSON payload
 *   3. Upload JSON evidence to IPFS (multi-pin strategy)
 *   4. ECDSA sign evidence digest
 *   5. Anchor hash + CID + signature on Ethereum (Sepolia)
 *   6. Auto-log chain-of-custody "Created" event
 *   7. Persist record with full latency metrics
 *   8. Trigger autonomous video capture (fire-and-forget)
 *
 * Research integrity rules (DO NOT remove):
 *   - NEVER anchor a fake/local CID on the blockchain.
 *   - NEVER store a mock transaction hash as a real one.
 *   - If IPFS or blockchain fails, the record is flagged but NOT fabricated.
 */

'use strict';

const { generateHash }  = require('../utils/hashUtil');
const { uploadJSONToIPFS, uploadJSONToIPFSDetailed } = require('./ipfsService');
const { storeOnBlockchain, logCustodyEvent: chainLogCustody } = require('./blockchainService');
const metricsLogger     = require('../utils/metricsLogger');
const fs   = require('fs');
const path = require('path');

// Lazy-load to avoid circular dependency with forensicService
let forensicService = null;
const getForensicService = () => {
    if (!forensicService) forensicService = require('./forensicService');
    return forensicService;
};

// ── Persistence (Firestore + Local Backup) ───────────────────────────────────
// Source of truth: Firebase Firestore (cloud, ACID-compliant)
// Fallback:        Local JSON file   (instant startup cache)
const admin           = require('../config/firebaseAdmin');
const firestoreDb     = admin.firestore();
const EVIDENCE_COLLECTION = 'evidence_records';

const BACKUP_FILE = path.join(__dirname, '../data/records.json');
let records = [];

// Phase 1: Synchronous load from local backup (instant startup — no async wait)
try {
    if (fs.existsSync(BACKUP_FILE)) {
        records = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        console.log(`💾 [AccidentService] Quick-loaded ${records.length} records from local backup.`);
    }
} catch (err) {
    console.error('❌ [AccidentService] Local backup load failed:', err.message);
    records = [];
}

// Phase 2: Async Firestore sync (Merges cloud into local to prevent data loss)
(async () => {
    try {
        const snapshot = await firestoreDb.collection(EVIDENCE_COLLECTION).get();
        if (!snapshot.empty) {
            const cloudRecords = snapshot.docs.map(doc => doc.data());
            
            // Smart Merge: We trust cloud for things like 'status' and 'assignedTo',
            // but we PREFER local for technical forensic fields (like videos) 
            // that might have been captured recently but not yet synced.
            cloudRecords.forEach(cr => {
                const localIdx = records.findIndex(lr => lr.id === cr.id);
                if (localIdx !== -1) {
                    // Update existing: Merge cloud status into local record
                    records[localIdx] = {
                        ...cr,
                        // Preserve video evidence if local has it but cloud doesn't
                        video: records[localIdx].video || cr.video,
                        // Preserve newer metrics if local has them
                        metrics: records[localIdx].metrics || cr.metrics
                    };
                } else {
                    // New record from cloud: Add to local
                    records.push(cr);
                }
            });

            console.log(`🔥 [AccidentService] Synced/Merged ${cloudRecords.length} records from Firestore.`);
            _backupToFile();
        } else if (records.length > 0) {
            // First run: migrate local records → Firestore
            console.log(`📦 [AccidentService] Migrating ${records.length} local records to Firestore...`);
            for (let i = 0; i < records.length; i += 450) {
                const batch = firestoreDb.batch();
                records.slice(i, i + 450).forEach(r => {
                    batch.set(firestoreDb.collection(EVIDENCE_COLLECTION).doc(r.id), r);
                });
                await batch.commit();
            }
            console.log(`✅ [AccidentService] Migration complete.`);
        }
    } catch (err) {
        console.error('⚠️  [AccidentService] Firestore sync failed — using local data:', err.message);
    }
})();

// Local JSON backup (sync, fast)
const _backupToFile = () => {
    try {
        const dir = path.dirname(BACKUP_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(records, null, 2));
    } catch (err) {
        console.error('❌ [AccidentService] Local backup error:', err.message);
    }
};

// Dual-write: Local backup (sync) + Firestore (async, fire-and-forget)
const saveToFile = () => {
    _backupToFile();
    // Batch-sync all records to Firestore (non-blocking)
    const batch = firestoreDb.batch();
    records.forEach(r => {
        batch.set(firestoreDb.collection(EVIDENCE_COLLECTION).doc(r.id), r, { merge: true });
    });
    batch.commit().catch(err => {
        console.error('❌ [AccidentService] Firestore sync error:', err.message);
    });
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
        gps_valid: gpsValid,
        gps_source: data.gps?.source || (gpsValid ? 'live_fix' : 'unavailable'),
        gps_confidence: data.gps?.confidence || (gpsValid ? 'high' : 'none'),
        impact_direction: data.impact_direction || null,
        pipeline_start_iso: new Date(pipelineStart).toISOString()
    };

    // ── 3. Stable cryptographic hash ─────────────────────────────────────────
    timer.mark('hash_start');
    const sortedEvidence = stableSort(evidenceData);
    const hash = generateHash(JSON.stringify(sortedEvidence));
    timer.mark('hash_end');
    console.log(`🔒 [AccidentService] SHA-256: ${hash}`);

    // ── 4. IPFS Upload (multi-pin strategy) ──────────────────────────────────
    let cid = null;
    let ipfsStatus = 'success';
    let ipfsDetails = null;

    timer.mark('ipfs_json_start');
    try {
        const ipfsResult = await uploadJSONToIPFSDetailed(evidenceData);
        cid = ipfsResult.cid;
        ipfsDetails = {
            providerResults: ipfsResult.providerResults,
            cidConsistent: ipfsResult.cidConsistent,
            totalLatencyMs: ipfsResult.totalLatencyMs,
        };
        timer.mark('ipfs_json_end');
        console.log(`📤 [AccidentService] IPFS JSON CID: ${cid}`);
        if (!ipfsResult.cidConsistent) {
            console.error('🚨 [AccidentService] CID MISMATCH across IPFS providers!');
        }
    } catch (e) {
        timer.mark('ipfs_json_end');
        ipfsStatus = 'failed';
        cid = null;
        console.error('❌ [AccidentService] IPFS upload failed:', e.message);
    }

    // ── 5. Blockchain Anchoring (with ECDSA signature) ───────────────────────
    let txHash = null;
    let blockchainMetrics = null;
    let blockchainStatus = 'skipped';
    let signatureData = null;

    if (cid) {
        timer.mark('blockchain_start');
        blockchainStatus = 'pending';
        try {
            const anchorResult = await storeOnBlockchain({ cid, hash, vehicleId: data.vehicle_id, timestamp });
            txHash = anchorResult.txHash;
            signatureData = {
                signature: anchorResult.signature,
                signerAddress: anchorResult.signerAddress,
                isDuplicate: anchorResult.isDuplicate,
            };
            blockchainMetrics = {
                gasUsed:     anchorResult.gasUsed,
                blockNumber: anchorResult.blockNumber,
                latencyMs:   anchorResult.confirmationMs
            };
            
            timer.mark('blockchain_end');
            blockchainStatus = 'confirmed';
            console.log(`⚓ [AccidentService] Blockchain TX: ${txHash}`);
        } catch (e) {
            timer.mark('blockchain_end');
            blockchainStatus = 'failed';
            txHash = null;
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
        blockchain_metrics: blockchainMetrics,

        // ECDSA signature (non-repudiation)
        signature: signatureData,

        // IPFS multi-pin details
        ipfsDetails,

        // Explicit storage status flags (never hide failures)
        ipfsStatus,
        blockchainStatus,
        gpsValid,
        gpsSource: evidenceData.gps_source,
        gpsConfidence: evidenceData.gps_confidence,

        // Impact direction (from ESP32 gyro fusion)
        impactDirection: data.impact_direction || null,

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
            stages: { ipfsStatus, blockchainStatus },
            signature: signatureData ? signatureData.signerAddress : null,
        }],

        // Latency metrics (populated after finalise())
        metrics: null
    };

    records.push(finalRecord);
    saveToFile();

    // ── 7. Finalise latency trace ─────────────────────────────────────────────
    const traceResult = timer.finalise();
    finalRecord.metrics = traceResult.durations;
    saveToFile();

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

// ── Custody Actions ───────────────────────────────────────────────────────────

/**
 * Log a custody action for a record (updates local timeline + optional on-chain).
 */
exports.logCustodyAction = (recordId, action, detail, actor) => {
    const record = records.find(r => r.id === recordId);
    if (!record) throw new Error('Case not found');

    record.timeline.push({
        action,
        by: actor || 'System',
        time: new Date().toISOString(),
        detail
    });
    saveToFile();
    return record;
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