// 🚀 SENSOR SIMULATOR 2.0 (Single-Event Forensic Record)
// --------------------------------------------------
// This tool simulates vehicle sensor data. 
// Once a collision is detected, it sends data and SHUTS DOWN.

const axios = require('axios');
const API_URL = "http://localhost:5000/api/accident/report";

// ⚙️ CONFIGURATION
const CHECK_INTERVAL = 3000;  // ⏱️ Check every 3 seconds
const RANDOM_RANGE = 2.0;    // 📊 Max random acceleration (0-2)
const THRESHOLD = 1.0;       // 💥 Lowered for immediate manual test

// 📊 SENSOR DATA GENERATOR
function generateSensorData() {
    return {
        accel: {
            x: (Math.random() * RANDOM_RANGE).toFixed(2),
            y: (Math.random() * RANDOM_RANGE).toFixed(2),
            z: (Math.random() * RANDOM_RANGE).toFixed(2)
        },
        gps: {
            lat: 16.3067 + (Math.random() * 0.01),
            lon: 80.4365 + (Math.random() * 0.01)
        }
    };
}

// 🕵️ COLLISION DETECTION
function detectCollision(data) {
    return (
        Math.abs(data.accel.x) > THRESHOLD ||
        Math.abs(data.accel.y) > THRESHOLD ||
        Math.abs(data.accel.z) > THRESHOLD
    );
}

// 🚀 SEND ACCIDENT TO BACKEND
async function sendAccident(data) {
    try {
        const payload = {
            vehicle_id: "AP09XX1234",
            gps: data.gps,
            impact: true,
            type: "SIMULATED_COLLISION"
        };

        console.log(`📤 Sending Forensics...`);
        const response = await axios.post(API_URL, payload, {
            headers: { "x-api-key": "device123" }
        });

        console.log("✅ Forensic Record Secured:", response.data.hash);
        console.log("--------------------------------------------------");

    } catch (error) {
        console.error("❌ Error:", error.response?.data || error.message);
    }
}

// 🏁 MAIN SIMULATION
async function startSimulation() {
    console.log("🚀 SENSOR SIMULATOR ACTIVE (Mode: Single-Shot)");
    console.log(`📊 Threshold: ${THRESHOLD} | Interval: ${CHECK_INTERVAL/1000}s`);
    console.log("--------------------------------------------------");

    const loop = setInterval(async () => {
        const data = generateSensorData();
        console.log(`[${new Date().toLocaleTimeString()}] Monitoring sensors...`);

        if (detectCollision(data)) {
            console.log("💥 REAL COLLISION DETECTED!");
            
            // 🛑 STOP MONITORING IMMEDIATELY
            clearInterval(loop);
            
            // 📤 SEND DATA
            await sendAccident(data);
            
            // 🚪 AUTO-SHUTDOWN TO PREVENT DUPLICATES
            console.log("🏁 Mission Complete. Forensic evidence secured.");
            console.log("🚪 Simulator process exiting.");
            process.exit(0);
        }
    }, CHECK_INTERVAL);
}

startSimulation();