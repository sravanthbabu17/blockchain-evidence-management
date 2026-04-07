const accidentService = require("../services/accidentService");
const forensicService = require("../services/forensicService");

/**
 * 💥 Handles Direct Impact Trigger (POST /api/impact)
 * For ESP32 direct triggers or Postman testing.
 * Creates a minimal case record and fires the forensic video pipeline.
 */
exports.handleImpact = async (req, res) => {
  const { vehicle_id } = req.body;

  if (!vehicle_id) {
    return res.status(400).json({ success: false, message: "vehicle_id is required." });
  }

  const timestamp = new Date().toISOString();
  const caseId = "case_" + Date.now();

  console.log(`💥 DIRECT IMPACT TRIGGER for ${vehicle_id}. Case: ${caseId}`);

  // Create a minimal record first so it appears in the dashboard immediately
  const record = {
    id: caseId,
    vehicle_id,
    timestamp,
    status: "pending",
    assigned: false,
    assignedTo: null,
    cid: null,
    hash: null,
    txHash: null,
    evidenceData: { source: "ESP32-Direct-Trigger", vehicle_id, timestamp },
    timeline: [
      { action: "Impact Detected (Direct Trigger)", by: "ESP32-Sensor", time: timestamp },
    ],
  };

  const records = accidentService.getAllRecords();
  records.push(record);
  accidentService.saveRecords();

  // Fire forensic video capture asynchronously (non-blocking)
  setImmediate(() => {
    forensicService.triggerForensicCapture(caseId, vehicle_id, timestamp);
  });

  res.json({
    success: true,
    caseId,
    message: "Forensic capture initiated. Video will be ready in ~35 seconds.",
  });
};
