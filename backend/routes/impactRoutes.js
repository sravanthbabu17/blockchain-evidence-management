const express = require("express");
const router = express.Router();
const impactController = require("../controllers/impactController");

/**
 * 💥 Forensic Impact Trigger
 * Used by ESP32 (Collision Sensor) or Postman (Mock Testing)
 */
router.post("/impact", impactController.handleImpact);

module.exports = router;
