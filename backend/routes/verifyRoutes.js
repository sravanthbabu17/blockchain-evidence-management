const express = require('express');
const router = express.Router();
const { verifyByCID, checkHashAnchored } = require('../controllers/verifyController');

// Blockchain data is public, but these routes remain read-only.
router.get('/hash-check/:hash', checkHashAnchored);
router.get('/:cid', verifyByCID);

module.exports = router;
