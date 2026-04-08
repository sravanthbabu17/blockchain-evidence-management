const express = require('express');
const router = express.Router();
const { verifyByCID } = require('../controllers/verifyController');

// GET /api/verify/:cid  — no auth needed, blockchain data is public
router.get('/:cid', verifyByCID);

module.exports = router;
