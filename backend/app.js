const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ IMPORT ROUTES
const accidentRoutes = require('./routes/accidentRoutes');

// ✅ MOUNT ROUTES
app.use('/api/accident', accidentRoutes);

// Health check
app.get('/', (req, res) => {
    res.send('🚀 EvidenceChain API: Active Audit Enclave');
});

module.exports = app;