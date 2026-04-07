const crypto = require("crypto");
const fs = require("fs");
const ipfsService = require("../services/ipfsService");
const accidentService = require("../services/accidentService");

/**
 * 🔗 Step 9: Final Forensic Case Linking Enclave
 */
const hashFile = (path) => {
    try {
        const fileBuffer = fs.readFileSync(path);
        return crypto.createHash("sha256").update(fileBuffer).digest("hex");
    } catch (err) {
        console.error("❌ Hashing Error:", err);
        return null;
    }
};

exports.handleVideo = async (req, res) => {
    try {
        console.log("📥 Step 9: Finalizing Forensic Evidence Chain...");
        const caseId = req.body.caseId;

        if (!req.files || !req.files.before || !req.files.after) {
            return res.status(400).json({ success: false, error: 'Missing evidence parts' });
        }

        // 1. Calculate Forensic Hashes (Integrity)
        const beforeHash = hashFile(req.files.before[0].path);
        const afterHash = hashFile(req.files.after[0].path);

        // 2. Pin to IPFS (Decentralized Storage)
        const beforeCid = await ipfsService.uploadFileToIPFS(req.files.before[0].path);
        const afterCid = await ipfsService.uploadFileToIPFS(req.files.after[0].path);

        // 3. 🏛️ Step 9: Case Linking (Persistence)
        const records = accidentService.getAllRecords();
        const record = records.find(r => r.id === caseId);

        if (!record) {
            console.error("❌ Case ID not found in forensic database:", caseId);
            return res.status(404).json({ success: false, error: 'Case ID not found' });
        }

        // Anchor the metadata
        record.video = {
            beforeCid,
            afterCid,
            beforeHash,
            afterHash,
            anchoredAt: new Date().toISOString()
        };

        // Update Forensic Timeline
        record.timeline.push({
            action: "Forensic Video Evidence Anchored",
            by: req.user?.email || "System (Authenticated Owner)",
            time: new Date().toISOString()
        });

        // 💾 Step 9: Commit to Disk
        accidentService.saveRecords();

        console.log("✅ Step 9: Case Linking Complete for ID:", caseId);

        res.json({ 
            success: true, 
            message: "Step 9: Forensic Evidence Chain Secured",
            data: record
        });

    } catch (err) {
        console.error("❌ Step 9 Controller Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
