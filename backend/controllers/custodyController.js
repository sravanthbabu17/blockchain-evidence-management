/**
 * custodyController.js — Chain-of-Custody API Handlers
 * Validates roles and delegates to blockchain service for on-chain logging.
 */

'use strict';

const blockchainService = require('../services/blockchainService');
const accidentService   = require('../services/accidentService');

// CustodyAction enum mapping (matches Solidity)
const CustodyAction = {
    Created: 0, Accessed: 1, Transferred: 2,
    StatusChanged: 3, Disputed: 4, Resolved: 5
};

const canReadRecord = (user, record) => {
    if (!user || !record) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'investigator' && record.assignedTo === user.email) return true;
    if (user.role === 'owner' && record.vehicle_id === user.vehicle_id) return true;
    return false;
};

const canWriteCustody = (user, record) => {
    if (!user || !record) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'investigator' && record.assignedTo === user.email) return true;
    return false;
};

/**
 * POST /api/custody/:recordId/log
 * Body: { action: "Accessed"|"Disputed"|"Resolved"|"StatusChanged", detail: "..." }
 */
exports.logCustodyEvent = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { action, detail } = req.body;

        if (!action || !detail) {
            return res.status(400).json({ success: false, error: 'action and detail required' });
        }

        const actionEnum = CustodyAction[action];
        if (actionEnum === undefined) {
            return res.status(400).json({ success: false, error: `Invalid action. Use: ${Object.keys(CustodyAction).join(', ')}` });
        }

        // Find the on-chain record index from local records
        const records = accidentService.getAllRecords();
        const record = records.find(r => r.id === recordId);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        if (!canWriteCustody(req.user, record)) {
            return res.status(403).json({ success: false, error: 'Only admins or the assigned investigator can log custody events' });
        }

        // Log on-chain (if record has a txHash, meaning it's anchored)
        let chainResult = null;
        if (record.txHash) {
            try {
                const total = await blockchainService.getTotalRecords();
                // Find on-chain index by matching CID
                const { found, index } = await blockchainService.verifyCID(record.cid);
                if (found) {
                    chainResult = await blockchainService.logCustodyEvent(index, actionEnum, detail);
                }
            } catch (e) {
                console.warn('⚠️  [CustodyController] On-chain log failed (non-fatal):', e.message);
            }
        }

        // Log locally
        accidentService.logCustodyAction(recordId, action, detail, req.user.email);

        res.json({
            success: true,
            action,
            detail,
            onChain: chainResult ? { txHash: chainResult.txHash, gasUsed: chainResult.gasUsed } : null
        });
    } catch (err) {
        console.error('❌ [CustodyController] logCustodyEvent error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/custody/:recordId/transfer
 * Body: { newCustodian: "0x...", detail: "Reason for transfer" }
 */
exports.transferCustody = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { newCustodian, detail } = req.body;

        if (!newCustodian || !detail) {
            return res.status(400).json({ success: false, error: 'newCustodian and detail required' });
        }

        const records = accidentService.getAllRecords();
        const record = records.find(r => r.id === recordId);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        if (!canWriteCustody(req.user, record)) {
            return res.status(403).json({ success: false, error: 'Only admins or the assigned investigator can transfer custody' });
        }

        let chainResult = null;
        if (record.txHash) {
            try {
                const { found, index } = await blockchainService.verifyCID(record.cid);
                if (found) {
                    chainResult = await blockchainService.transferCustody(index, newCustodian, detail);
                }
            } catch (e) {
                console.warn('⚠️  [CustodyController] On-chain transfer failed:', e.message);
            }
        }

        accidentService.logCustodyAction(recordId, 'Transferred', `${detail} -> ${newCustodian}`, req.user.email);

        res.json({
            success: true,
            newCustodian,
            detail,
            onChain: chainResult ? { txHash: chainResult.txHash, gasUsed: chainResult.gasUsed } : null
        });
    } catch (err) {
        console.error('❌ [CustodyController] transferCustody error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/custody/:recordId/current
 * Returns current custodian and status from on-chain state.
 */
exports.getCustodyInfo = async (req, res) => {
    try {
        const { recordId } = req.params;
        const records = accidentService.getAllRecords();
        const record = records.find(r => r.id === recordId);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        if (!canReadRecord(req.user, record)) {
            return res.status(403).json({ success: false, error: 'Access denied for this record' });
        }

        let onChainInfo = null;
        if (record.cid && record.txHash) {
            try {
                const { found, index } = await blockchainService.verifyCID(record.cid);
                if (found) {
                    onChainInfo = await blockchainService.getCustodyInfo(index);
                }
            } catch (e) {
                console.warn('⚠️  [CustodyController] On-chain read failed:', e.message);
            }
        }

        res.json({
            success: true,
            recordId,
            timeline: record.timeline || [],
            onChain: onChainInfo,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/custody/:recordId/history
 * Returns the full local timeline for a record.
 */
exports.getCustodyHistory = async (req, res) => {
    try {
        const { recordId } = req.params;
        const records = accidentService.getAllRecords();
        const record = records.find(r => r.id === recordId);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }
        if (!canReadRecord(req.user, record)) {
            return res.status(403).json({ success: false, error: 'Access denied for this record' });
        }

        res.json({
            success: true,
            recordId,
            timeline: record.timeline || [],
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
