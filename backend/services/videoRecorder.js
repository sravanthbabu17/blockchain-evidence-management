const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

let ffmpegProcess = null;
let usingFallback = false;

const outputPath = path.join(__dirname, "../recording.ts");
const CAMERA_DEVICE = "video=Integrated Camera";

// Real camera args (DirectShow)
const cameraArgs = ["-f", "dshow", "-i", CAMERA_DEVICE];

// Software fallback — no camera needed
const fallbackArgs = ["-f", "lavfi", "-i", "testsrc=size=1280x720:rate=15"];

/**
 * 🎥 Start recording. Tries real camera first.
 * Auto-falls back to a software test pattern if camera is busy/unavailable.
 */
function startRecording(forceFallback = false) {
  if (ffmpegProcess) return;

  usingFallback = forceFallback;
  const sourceArgs = forceFallback ? fallbackArgs : cameraArgs;
  const label = forceFallback ? "🔁 Software Test Pattern" : "📷 Integrated Camera";

  console.log(`🎥 Starting forensic recording [${label}]...`);

  let ioErrorDetected = false;

  ffmpegProcess = spawn("ffmpeg", [
    ...sourceArgs,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-f", "mpegts",
    "-y",
    outputPath
  ]);

  ffmpegProcess.stderr.on("data", (data) => {
    const msg = data.toString();
    // Detect camera locked by another process
    if (!forceFallback && (msg.includes("I/O error") || msg.includes("unable to open device"))) {
      ioErrorDetected = true;
      console.warn("⚠️  Camera is locked by another app. Falling back to software test pattern...");
      console.warn("   Fix: Close Teams, Zoom, browser camera tabs, or Windows Camera app.");
    } else if (msg.includes("Error") && !msg.includes("Error while decoding")) {
      console.error(`❌ FFmpeg: ${msg.trim()}`);
    }
  });

  ffmpegProcess.on("close", (code) => {
    ffmpegProcess = null;

    if (ioErrorDetected) {
      // Camera was busy — immediately retry with software fallback
      console.log("🔄 Switching to software test pattern (camera was locked).");
      setTimeout(() => startRecording(true), 1000);
    } else if (!forceFallback && code !== 0 && code !== null) {
      // Camera crashed unexpectedly — retry camera after delay
      console.log("🔄 Recording crashed. Retrying in 10 seconds...");
      setTimeout(() => startRecording(false), 10000);
    } else if (forceFallback) {
      // Test-pattern exited — keep it running
      console.log("🔄 Restarting test-pattern recording in 5 seconds...");
      setTimeout(() => startRecording(true), 5000);
    }
  });

  ffmpegProcess.on("error", (err) => {
    console.error("❌ FFmpeg spawn error:", err.message);
    ffmpegProcess = null;
  });
}

/**
 * ⏹️ Stop recording cleanly.
 */
function stopRecording() {
  if (ffmpegProcess) {
    ffmpegProcess.kill("SIGTERM");
    ffmpegProcess = null;
    console.log("⏹️  Recording stopped.");
  }
}

module.exports = { startRecording, stopRecording };
