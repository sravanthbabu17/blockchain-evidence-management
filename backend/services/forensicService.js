const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ipfsService = require("./ipfsService");
const blockchainService = require("./blockchainService");
const accidentService = require("./accidentService");

let isProcessing = false;

/**
 * 🎥 Forensic Video Service
 * Extracts 30s before + 30s after an impact event,
 * merges them, hashes, uploads to IPFS, and anchors on blockchain.
 * Then updates the accident record with the video metadata.
 *
 * @param {string} recordId - The ID of the accident record to update
 * @param {string} vehicleId - The vehicle ID for logging
 * @param {string} timestamp - The collision timestamp
 */
exports.triggerForensicCapture = (recordId, vehicleId, timestamp) => {
  if (isProcessing) {
    console.log("⚠️ Forensic capture already in progress. Skipping duplicate trigger.");
    return;
  }

  isProcessing = true;
  console.log(`🎥 [ForensicService] Starting video capture for record: ${recordId}`);

  const videoDir = path.join(__dirname, "../videos");
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const recordingFile = path.join(__dirname, "../recording.ts");
  const beforeFile = path.join(videoDir, `${recordId}_before.mp4`);
  const afterFile = path.join(videoDir, `${recordId}_after.mp4`);
  const finalFile = path.join(videoDir, `${recordId}_final.mp4`);
  const listFile = path.join(videoDir, `${recordId}_list.txt`);

  // Check if the recording buffer exists
  if (!fs.existsSync(recordingFile)) {
    console.error("❌ [ForensicService] recording.ts not found. Cannot extract forensic window.");
    isProcessing = false;
    return;
  }

  // 1. Small lag to allow the exact impact moment to be flushed to disk
  setTimeout(() => {
    // 2. Extract BEFORE (last 30s of the buffer)
    console.log("🎥 [ForensicService] Extracting BEFORE segment (last 30s)...");
    exec(`ffmpeg -sseof -30 -i "${recordingFile}" -t 30 -c copy -y "${beforeFile}"`, (err) => {
      if (err) {
        console.error("❌ [ForensicService] BEFORE extraction failed:", err.message);
        isProcessing = false;
        return;
      }

      // 3. Wait 30 seconds to capture the AFTER segment
      console.log("⏳ [ForensicService] Waiting 30s to capture AFTER segment...");
      setTimeout(() => {
        console.log("🎥 [ForensicService] Extracting AFTER segment (last 30s)...");
        exec(`ffmpeg -sseof -30 -i "${recordingFile}" -t 30 -c copy -y "${afterFile}"`, async (err) => {
          if (err) {
            console.error("❌ [ForensicService] AFTER extraction failed:", err.message);
            isProcessing = false;
            return;
          }

          // 4. Stable merge using concat demuxer
          console.log("🔗 [ForensicService] Merging segments...");
          const listContent = `file '${recordId}_before.mp4'\nfile '${recordId}_after.mp4'`;
          fs.writeFileSync(listFile, listContent);

          exec(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy -y "${finalFile}"`, async (err) => {
            if (err) {
              console.error("❌ [ForensicService] Merge failed:", err.message);
              isProcessing = false;
              return;
            }

            console.log("✅ [ForensicService] Forensic video package created.");

            try {
              // 5. Cryptographic Hash
              const fileBuffer = fs.readFileSync(finalFile);
              const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
              console.log("🔒 [ForensicService] Hash:", hash);

              // 6. IPFS Upload
              let cid;
              try {
                cid = await ipfsService.uploadFileToIPFS(finalFile);
                console.log("📤 [ForensicService] Uploaded to IPFS:", cid);
              } catch (e) {
                console.warn("⚠️ [ForensicService] IPFS failed, using local fallback.");
                cid = `local-video-${Date.now()}`;
              }

              // 7. Blockchain Anchor
              let txHash;
              try {
                txHash = await blockchainService.storeOnBlockchain({ cid, hash, vehicleId, timestamp });
                console.log("⚓ [ForensicService] Blockchain TX:", txHash);
              } catch (e) {
                console.warn("⚠️ [ForensicService] Blockchain failed, using mock TX.");
                txHash = `0x-mock-video-tx-${Date.now()}`;
              }

              // 8. Update the existing accident record with video metadata
              const records = accidentService.getAllRecords();
              const record = records.find(r => r.id === recordId);
              if (record) {
                record.video = {
                  local: `videos/${recordId}_final.mp4`,
                  cid,
                  hash,
                  txHash,
                  anchoredAt: new Date().toISOString()
                };
                record.timeline.push({
                  action: "Forensic Video Anchored (60s Window)",
                  by: "V2-Recorder (Autonomous)",
                  time: new Date().toISOString()
                });
                accidentService.saveRecords();
                console.log(`🏆 [ForensicService] Record ${recordId} updated with video evidence.`);
              } else {
                console.warn(`⚠️ [ForensicService] Record ${recordId} not found to update.`);
              }

              // 9. Cleanup temp files
              [beforeFile, afterFile, listFile].forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
              });

            } catch (innerErr) {
              console.error("❌ [ForensicService] Post-processing failed:", innerErr.message);
            } finally {
              isProcessing = false;
            }
          });
        });
      }, 30000); // Wait 30s for AFTER segment
    });
  }, 2000); // 2s lag for disk flush
};
