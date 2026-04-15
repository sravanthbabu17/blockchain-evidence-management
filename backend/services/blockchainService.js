/**
 * blockchainService.js — EvidenceChain Blockchain Anchor Layer
 * -------------------------------------------------------------
 * Anchors evidence metadata to the AccidentEvidence smart contract
 * on Ethereum Sepolia Testnet via Alchemy RPC.
 *
 * Logs:
 *   - Gas used          (for paper: Table "Gas Cost per Evidence Record")
 *   - Block number      (for verification proof)
 *   - Confirmation time (for paper: Table "Blockchain Confirmation Latency")
 */

'use strict';

const { ethers } = require('ethers');
require('dotenv').config();

// ── Contract Configuration ────────────────────────────────────────────────────
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xd2CFB837a34d9a704df42E87FfEC7E894D4715F4';

// Full ABI including access-control functions (for completeness)
const ABI = [
    // Evidence submission (requires authorised node)
    'function addEvidenceRecord(string,string,string,uint256) external',
    // Read-only queries
    'function getTotalRecords() external view returns (uint256)',
    'function getRecord(uint256) external view returns (string,string,string,uint256,address)',
    'function verifyCID(string) external view returns (bool,uint256)',
    // Owner management
    'function authoriseNode(address) external',
    'function revokeNode(address) external',
    // Events
    'event RecordAdded(uint256 indexed,string,string,string indexed,uint256,address indexed)'
];

// ── Provider / Wallet Setup ───────────────────────────────────────────────────
if (!process.env.ALCHEMY_URL || !process.env.PRIVATE_KEY) {
    console.error('❌ [BlockchainService] CRITICAL: ALCHEMY_URL or PRIVATE_KEY missing in .env');
}

const NETWORK_NAME = process.env.NETWORK_NAME || 'sepolia';
const CHAIN_ID     = parseInt(process.env.CHAIN_ID || '11155111', 10);
const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet';

console.log(`⛓️  [BlockchainService] Network: ${NETWORK_NAME} (ID: ${CHAIN_ID}) [Mode: ${NETWORK_MODE}]`);
if (NETWORK_MODE === 'testnet') {
    console.warn('⚠️  [BlockchainService] INFO: Operating on testnet for prototyping.');
}

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL, {
    name: NETWORK_NAME,
    chainId: CHAIN_ID
});

const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

// ── Core: Anchor Evidence ─────────────────────────────────────────────────────

/**
 * Anchor evidence metadata on the blockchain.
 * @param {object} opts
 * @param {string} opts.cid        - Real IPFS CID (must not be a local fallback)
 * @param {string} opts.hash       - SHA-256 hex digest of the JSON payload
 * @param {string} opts.vehicleId  - Vehicle / device ID
 * @param {string} opts.timestamp  - ISO 8601 collision timestamp
 * @returns {{ txHash, blockNumber, gasUsed, confirmationMs }} metrics
 */
exports.storeOnBlockchain = async ({ cid, hash, vehicleId, timestamp }) => {
    const txStart = Date.now();

    console.log(`⛓️  [BlockchainService] Anchoring evidence for ${vehicleId}...`);

    const unixTimestamp = Math.floor(new Date(timestamp).getTime() / 1000);

    const tx = await contract.addEvidenceRecord(cid, hash, vehicleId, unixTimestamp);

    console.log(`⛓️  [BlockchainService] TX submitted: ${tx.hash} — awaiting confirmation...`);

    const receipt = await tx.wait();
    const confirmationMs = Date.now() - txStart;

    // Extract gas metrics for the research paper
    const gasUsed = receipt.gasUsed !== undefined
        ? Number(receipt.gasUsed)
        : null;

    console.log(`✅ [BlockchainService] Confirmed in block ${receipt.blockNumber}`);
    console.log(`   TX Hash    : ${tx.hash}`);
    console.log(`   Gas Used   : ${gasUsed?.toLocaleString() ?? 'N/A'} units`);
    console.log(`   Conf. Time : ${confirmationMs} ms`);

    return {
        txHash:         tx.hash,
        blockNumber:    receipt.blockNumber,
        gasUsed,
        confirmationMs,
    };
};

/**
 * Read-only: retrieve a record from the chain (used by verifyController).
 */
exports.getRecordFromChain = async (index) => {
    const [cid, jsonHash, vehicleId, timestamp, uploadedBy] =
        await contract.getRecord(index);
    return { cid, jsonHash, vehicleId, timestamp: Number(timestamp), uploadedBy };
};

/**
 * Read-only: check whether a CID is already anchored.
 */
exports.verifyCID = async (cid) => {
    const [found, index] = await contract.verifyCID(cid);
    return { found, index: Number(index) };
};

/**
 * Read-only: total number of anchored records.
 */
exports.getTotalRecords = async () => {
    return Number(await contract.getTotalRecords());
};