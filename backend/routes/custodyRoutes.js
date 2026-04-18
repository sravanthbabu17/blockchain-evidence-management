/**
 * custodyRoutes.js — Chain-of-Custody API Routes
 */

'use strict';

const express = require('express');
const router  = express.Router();
const custodyController = require('../controllers/custodyController');
const verifyFirebaseToken = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(verifyFirebaseToken);

// Log a custody action
router.post('/:recordId/log', allowRoles('admin', 'investigator'), custodyController.logCustodyEvent);

// Transfer custody
router.post('/:recordId/transfer', allowRoles('admin', 'investigator'), custodyController.transferCustody);

// Get current custody info (on-chain state)
router.get('/:recordId/current', custodyController.getCustodyInfo);

// Get full custody history (local timeline)
router.get('/:recordId/history', custodyController.getCustodyHistory);

module.exports = router;
