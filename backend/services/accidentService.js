const { generateHash } = require('../utils/hashUtil');
const { uploadJSONToIPFS } = require('./ipfsService');
const { storeOnBlockchain } = require('./blockchainService');
const fs = require('fs');
const path = require('path');
// Loaded lazily to avoid circular dependency
let forensicService = null;
const getForensicService = () => {
    if (!forensicService) forensicService = require('./forensicService');
    return forensicService;
};

// 💾 PERSISTENCE CONFIG
const DATA_FILE = path.join(__dirname, '../data/records.json');

// 🔥 GLOBAL MEMORY STORAGE
let records = [];

// 📑 LOAD DATA ON STARTUP
try {
    if (fs.existsSync(DATA_FILE)) {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        records = JSON.parse(rawData);
        console.log("💾 PERSISTED DATA LOADED:", records.length, "records");
    }
} catch (err) {
    console.error("❌ Failed to load persisted data:", err.message);
    records = [];
}

// 💾 SAVE DATA HELPER
const saveToFile = () => {
    try {
        if (!fs.existsSync(path.dirname(DATA_FILE))) {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
    } catch (err) {
        console.error("❌ Persistence Error:", err.message);
    }
};

// ⚙️ RECURSIVE STABLE SORT (Cryptographic Consistency)
const stableSort = (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(stableSort);
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    for (let key of sortedKeys) {
        result[key] = stableSort(obj[key]);
    }
    return result;
};

// 🚨 PROCESS ACCIDENT
exports.processAccidentData = async (data) => {
    try {
        // 1. Data Validation & Preparation
        if (!data || !data.vehicle_id) throw new Error("Invalid accident record: Missing vehicle_id");
        
        const timestamp = data.timestamp || new Date().toISOString();
        const evidenceData = { ...data }; // The forensic payload

        // 2. Stable Forensic Hashing (Isolate ONLY evidenceData)
        const sortedEvidence = stableSort(evidenceData);
        const hash = generateHash(JSON.stringify(sortedEvidence));

        // 3. Attempt External Proofs (Indestructible Demo Logic)
        let cid, txHash;
        try {
            cid = await uploadJSONToIPFS(evidenceData);
        } catch (e) {
            console.warn("⚠️ IPFS Failed - Defaulting to local CID backup");
            cid = `local-${Date.now()}`;
        }

        try {
            txHash = await storeOnBlockchain({ cid, hash, vehicleId: data.vehicle_id, timestamp });
        } catch (e) {
            console.warn("⚠️ Blockchain Proof Failed - Defaulting to mock TX");
            txHash = `0x-mock-tx-${Date.now()}`;
        }

        // 4. Record Finalization (Single Source of Truth Record)
        const finalRecord = {
            id: Date.now().toString(), // Added for case assignment
            vehicle_id: data.vehicle_id,
            cid,
            hash,
            txHash,
            timestamp,
            evidenceData, 
            verifiedAt: null,
            
            // 🏷️ INVESTIGATION SYSTEM FIELDS (WORKFLOW)
            status: "pending",
            assigned: false,
            assignedTo: null,

            // 📜 FORENSIC TIMELINE (Audit Trail)
            timeline: [
                {
                    action: "Case Created",
                    by: "System (Forensic Enclave)",
                    time: new Date().toISOString()
                }
            ]
        };

        records.push(finalRecord);
        saveToFile(); // 💾 Persist instantly
        console.log("📦 FORENSIC RECORD SECURED:", finalRecord.vehicle_id);

        // 🎥 AUTO-TRIGGER FORENSIC VIDEO if impact detected
        if (data.impact === true) {
            console.log("💥 Impact flag detected — triggering forensic video capture...");
            // Fire-and-forget: does not block the sensor response
            setImmediate(() => {
                getForensicService().triggerForensicCapture(
                    finalRecord.id,
                    finalRecord.vehicle_id,
                    timestamp
                );
            });
        }

        return finalRecord;

    } catch (error) {
        console.error("❌ Forensic Processing Failure:", error.message);
        throw error;
    }
};

// 📊 GET ALL RECORDS
exports.getAllRecords = () => {
    return records;
};

// 🏛️ ASSIGN CASE (Admin Only Action)
exports.assignCase = (id, investigator) => {
    const record = records.find(r => r.id === id);
    if (record) {
        record.status = "assigned";
        record.assigned = true;
        record.assignedTo = investigator || "Investigator_1";
        saveToFile(); // 💾 Persist update
        return record;
    }
    throw new Error("Case not found");
};

// 🔄 UPDATE WORKFLOW STATUS
exports.updateStatus = (id, status) => {
    const record = records.find(r => r.id === id);
    if (record) {
        record.status = status;
        saveToFile(); // 💾 Persist update
        return record;
    }
    throw new Error("Case not found");
};

// 💾 EXPORT PERSISTENCE (Step 1 Fix)
exports.saveRecords = saveToFile;