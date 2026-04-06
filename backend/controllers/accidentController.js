const accidentService = require('../services/accidentService');

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

// 🚨 Handle incoming accident data (POST /report)
exports.handleAccidentData = async (req, res, next) => {
    try {
        const data = req.body;
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'No data received' });
        }
        const result = await accidentService.processAccidentData(data);
        res.status(200).json({ success: true, message: 'Accident processed successfully', data: result });
    } catch (error) {
        console.error("❌ Controller error:", error.message);
        next(error);
    }
};

// 📊 Get all accident records (GET /all) - ROLE PROTECTED (Step 8)
exports.getAllAccidents = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Firebase Token Required' });
        }

        const { email, role, vehicle_id } = req.user;

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

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const record = accidentService.updateStatus(id, status);

        // 📜 RECORD IN TIMELINE (Using Centralized Logger)
        _logTimeline(record, `Workflow Status: ${status}`, req.user.email);

        res.status(200).json({ success: true, message: `Status updated to ${status}`, data: record });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};