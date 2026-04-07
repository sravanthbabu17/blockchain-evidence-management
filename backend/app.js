const express = require('express');
const cors = require('cors');
const path = require('path');
const { startRecording } = require('./services/videoRecorder');

const app = express();

app.use(cors());
app.use(express.json());

// 🎥 START CONTINUOUS FORENSIC RECORDING (Crash-Safe MPEG-TS)
startRecording();

// ✅ IMPORT ROUTES
const accidentRoutes = require('./routes/accidentRoutes');
const impactRoutes = require('./routes/impactRoutes'); // Digital Forensic Trigger

// 📂 Ensure Directories Exist
const fs = require('fs');
['uploads/temp', 'uploads/chunks', 'videos', 'data'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 📁 SERVE FORENSIC VIDEOS (Fast Demo Playback)
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// ✅ MOUNT ROUTES
app.use('/api/accident', accidentRoutes);
app.use('/api', impactRoutes); // Trigger: POST /api/impact

// Health check
app.get('/', (req, res) => {
    res.send('🚀 EvidenceChain API: Forensic Enclave Active');
});

module.exports = app;