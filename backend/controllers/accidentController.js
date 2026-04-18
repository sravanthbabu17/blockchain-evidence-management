const accidentService = require('../services/accidentService');
const ipfsService = require('../services/ipfsService');
const path = require('path');
const fs = require('fs');

// 📜 PRIVATE HELPER: Audit Trail Logging
const _logTimeline = (record, action, by, to = null) => {
    if (record && record.timeline) {
        record.timeline.push({
            action,
            by,
            time: new Date().toISOString(),
            ...(to && { to })
        });
    }
};

// 🚨 Handle incoming sensor report (POST /report)
// Note: Forensic video is now triggered separately via /api/impact
exports.handleAccidentData = async (req, res, next) => {
    try {
        const data = req.body;
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'No data received' });
        }
        if (!data.vehicle_id || typeof data.vehicle_id !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(data.vehicle_id)) {
            return res.status(400).json({ success: false, message: 'A valid vehicle_id is required' });
        }
        
        console.log("⚡ Processing Incoming Sensor Report (Legacy)...");
        const result = await accidentService.processAccidentData(data);
        
        console.log(`✅ Case Created: ${result.id}`);

        res.status(200).json({ 
            success: true, 
            message: 'Sensor data recorded successfully.', 
            data: result 
        });
    } catch (error) {
        console.error("❌ Controller error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * 📊 Get all accident records (GET /all) - ROLE PROTECTED (Step 8)
 */
exports.getAllAccidents = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Firebase Token Required' });
        }

        const { email, role, vehicle_id } = req.user;
        console.log(`🔍 [AccidentController] Fetching records for: ${email} | Role: ${role}`);

        if (!role) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Identity Role Missing in Firestore' });
        }

        let data = accidentService.getAllRecords();

        // 🛡️ ROLE-BASED FILTERING (SERVER SIDE PROTECTION via JWT)
        if (role === "admin") {
            // Admins see everything
        } else if (role === "investigator") {
            // Investigators see only assigned cases
            data = data.filter(r => r.assignedTo === email);
        } else if (role === "owner") {
            // Owners see only their specific vehicle
            if (!vehicle_id) return res.status(400).json({ success: false, message: 'Vehicle ID missing in Firestore Identity' });
            data = data.filter(r => r.vehicle_id === vehicle_id);
        } else {
            return res.status(403).json({ success: false, message: 'Access denied: Invalid Role' });
        }

        console.log(`✅ [AccidentController] Returning ${data.length} records.`);
        res.status(200).json({ success: true, data });

    } catch (error) {
        console.error("❌ Fetch error:", error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch records' });
    }
};

// 📊 Get single accident by ID (GET /:id)
exports.getAccidentById = (req, res) => {
    try {
        const { id } = req.params;
        const record = accidentService.getAllRecords().find(r => r.id === id);
        
        if (!record) return res.status(404).json({ success: false, message: 'Case record not found' });

        // Basic RBAC for single record
        if (req.user.role !== "admin" && record.assignedTo !== req.user.email && record.vehicle_id !== req.user.vehicle_id) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this case' });
        }

        res.status(200).json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const canMutateRecord = (user, record) => {
    if (!user || !record) return false;
    if (user.role === "admin") return true;
    if (user.role === "investigator" && record.assignedTo === user.email) return true;
    return false;
};

// 🛡️ Admin Assign Case (POST /assign/:id)
exports.assignAccident = (req, res) => {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: 'Only Verified Admins can assign cases' });
        }
        
        const { id } = req.params;
        const { investigator } = req.body || {};
        
        // This relies on the accidentService.assignCase method
        const record = accidentService.assignCase(id, investigator);

        // 📜 RECORD IN TIMELINE (Using Centralized Logger)
        _logTimeline(record, "Assigned Case", req.user.email, investigator);

        res.status(200).json({ success: true, message: 'Case assigned successfully', data: record });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

// 🔄 Update Workflow Status (POST /status/:id)
exports.updateStatus = (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const allowedStatuses = new Set(['pending', 'assigned', 'investigating', 'verified', 'closed', 'tampered']);

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        if (!allowedStatuses.has(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const existing = accidentService.getAllRecords().find(r => r.id === id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        if (!canMutateRecord(req.user, existing)) {
            return res.status(403).json({ success: false, message: 'Only admins or the assigned investigator can update this case' });
        }

        const record = accidentService.updateStatus(id, status);

        // 📜 RECORD IN TIMELINE (Using Centralized Logger)
        _logTimeline(record, `Workflow Status: ${status}`, req.user.email);

        res.status(200).json({ success: true, message: `Status updated to ${status}`, data: record });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};
