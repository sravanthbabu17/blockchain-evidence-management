const { ethers } = require('ethers');
require('dotenv').config();

const CONTRACT_ADDRESS = '0x6775f902993ab3B4F250189Be85558F09e02b7dc';

const ABI = [
    'function getTotalRecords() public view returns (uint256)',
    'function getRecord(uint256 index) public view returns (string, string, string, uint256, address)',
];

// Use the already-configured Alchemy URL (reliable, no CORS issues)
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL, {
    name: 'sepolia',
    chainId: 11155111
});

// Read-only — no wallet needed for queries
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

/**
 * GET /api/verify/:cid
 * Scans all on-chain records to find one matching the given CID.
 * Returns the stored hash so the frontend can compare it locally.
 */
exports.verifyByCID = async (req, res) => {
    const { cid } = req.params;

    if (!cid || cid.trim() === '') {
        return res.status(400).json({ success: false, message: 'CID is required.' });
    }

    try {
        const totalBig = await contract.getTotalRecords();
        const total = Number(totalBig);

        if (total === 0) {
            return res.json({ success: true, found: false, total: 0 });
        }

        // Scan newest-first for speed
        for (let i = total - 1; i >= 0; i--) {
            const [recordCid, jsonHash, vehicleId, timestamp, uploadedBy] = await contract.getRecord(i);

            if (recordCid === cid.trim()) {
                return res.json({
                    success: true,
                    found: true,
                    record: {
                        index:      i,
                        cid:        recordCid,
                        jsonHash,
                        vehicleId,
                        timestamp:  Number(timestamp),
                        uploadedBy,
                    }
                });
            }
        }

        // CID not found after scanning all records
        return res.json({ success: true, found: false, total, scanned: total });

    } catch (error) {
        console.error('❌ Blockchain verify error:', error.message);
        res.status(500).json({ success: false, message: 'Blockchain query failed: ' + error.message });
    }
};
