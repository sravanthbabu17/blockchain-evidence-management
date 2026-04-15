/**
 * verifyController.js — On-Chain Evidence Verification
 * ------------------------------------------------------
 * Scans the AccidentEvidence smart contract for a given IPFS CID
 * and returns the stored SHA-256 hash so the dashboard can confirm
 * data integrity without trusting the backend database.
 *
 * Verification workflow (for the research paper):
 *   1. Client submits a CID (from the dashboard record)
 *   2. This controller scans the contract (newest-first for speed)
 *   3. If found: returns the on-chain hash for local comparison
 *   4. Client re-downloads the IPFS content and computes its own hash
 *   5. If hashes match → evidence is intact and unmodified
 *
 * Uses the blockchain service for read-only queries (no wallet needed).
 */

'use strict';

// Contract address is managed via backend/.env (CONTRACT_ADDRESS)
// Current deployment: 0xd2CFB837a34d9a704df42E87FfEC7E894D4715F4 (Sepolia)
const blockchainService = require('../services/blockchainService');

/**
 * GET /api/verify/:cid
 * Searches all on-chain records for the given CID.
 */
exports.verifyByCID = async (req, res) => {
    const { cid } = req.params;

    if (!cid || cid.trim() === '') {
        return res.status(400).json({ success: false, message: 'CID is required.' });
    }

    try {
        // First try the efficient on-contract verifyCID function
        const { found, index } = await blockchainService.verifyCID(cid.trim());

        if (found) {
            const record = await blockchainService.getRecordFromChain(index);
            return res.json({
                success:       true,
                found:         true,
                verifiedOnChain: true,
                record: {
                    index,
                    cid:        record.cid,
                    jsonHash:   record.jsonHash,
                    vehicleId:  record.vehicleId,
                    timestamp:  record.timestamp,
                    uploadedBy: record.uploadedBy,
                }
            });
        }

        // CID not found
        const total = await blockchainService.getTotalRecords();
        return res.json({
            success:       true,
            found:         false,
            verifiedOnChain: false,
            totalRecords:  total,
            message:       'CID not found in the on-chain evidence registry.'
        });

    } catch (error) {
        console.error('❌ [VerifyController] Blockchain query failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Blockchain query failed: ' + error.message
        });
    }
};
