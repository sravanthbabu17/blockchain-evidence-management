const express = require('express');
const router = express.Router();

const {
    handleAccidentData,
    getAllAccidents,
    getAccidentById,
    assignAccident,
    updateStatus
} = require('../controllers/accidentController');

const apiKeyMiddleware = require('../middleware/apiKeyMiddleware');

const verifyFirebaseToken = require('../middleware/authMiddleware');

// POST → for simulator
router.post('/report', apiKeyMiddleware, handleAccidentData);

// GET → for dashboard
router.get('/all', verifyFirebaseToken, getAllAccidents);

// GET → single case for real-time timeline sync
router.get('/:id', verifyFirebaseToken, getAccidentById);

// POST → for admin assigning cases
router.post('/assign/:id', verifyFirebaseToken, assignAccident);

// POST → for status updates (Investigator/Admin)
router.post('/status/:id', verifyFirebaseToken, updateStatus);

module.exports = router;