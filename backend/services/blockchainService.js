/**
 * blockchainService.js — EvidenceChain Blockchain Anchor Layer v2.0
 * ------------------------------------------------------------------
 * Anchors evidence metadata to the AccidentEvidence v2.0 smart contract
 * on Ethereum Sepolia Testnet via Alchemy RPC.
 *
 * v2.0 additions:
 *   - ECDSA signature enforcement (signs before anchoring)
 *   - Chain-of-custody logging + transfer
 *   - RBAC role management
 *   - Duplicate hash checking
 *
 * Logs:
 *   - Gas used          (for paper: Table "Gas Cost per Evidence Record")
 *   - Block number      (for verification proof)
 *   - Confirmation time (for paper: Table "Blockchain Confirmation Latency")
 */

'use strict';

const { ethers } = require('ethers');
const { signEvidenceHash } = require('./signatureService');
require('dotenv').config();

// ── Contract Configuration ────────────────────────────────────────────────────
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xd2CFB837a34d9a704df42E87FfEC7E894D4715F4';

// Full ABI for v2.0 contract
const ABI = [
    // Evidence submission (v2: includes signature)
    'function addEvidenceRecord(string,string,string,uint256,bytes) external',
    // Read-only queries
    'function getTotalRecords() external view returns (uint256)',
    'function getRecord(uint256) external view returns (string,string,string,uint256,address,bytes)',
    'function verifyCID(string) external view returns (bool,uint256)',
    'function verifyRecordSignature(uint256) external view returns (bool,address)',
    'function isHashAnchored(string) external view returns (bool)',
    'function getCustodyInfo(uint256) external view returns (address,uint8)',
    'function getRole(address) external view returns (uint8)',
    // Node management
    'function authoriseNode(address) external',
    'function revokeNode(address) external',
    // RBAC
    'function grantRole(address,uint8) external',
    'function revokeRole(address) external',
    // Chain of custody
    'function logCustodyEvent(uint256,uint8,string) external',
    'function transferCustody(uint256,address,string) external',
    // Events
    'event RecordAdded(uint256 indexed,string,string,string indexed,uint256,address indexed)',
    'event CustodyEvent(uint256 indexed,uint8,address indexed,uint256,string)',
    'event DuplicateHashWarning(uint256 indexed,bytes32 indexed,address indexed)',
    'event RoleGranted(address indexed,uint8)',
    'event RoleRevoked(address indexed)'
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

// ── Core: Anchor Evidence (v2: with ECDSA signature) ──────────────────────────

/**
 * Anchor evidence metadata on the blockchain with ECDSA signature.
 * @param {object} opts
 * @param {string} opts.cid        - Real IPFS CID
 * @param {string} opts.hash       - SHA-256 hex digest of the JSON payload
 * @param {string} opts.vehicleId  - Vehicle / device ID
 * @param {string} opts.timestamp  - ISO 8601 collision timestamp
 * @returns {{ txHash, blockNumber, gasUsed, confirmationMs, signature, signerAddress }}
 */
exports.storeOnBlockchain = async ({ cid, hash, vehicleId, timestamp }) => {
    const txStart = Date.now();
    console.log(`⛓️  [BlockchainService] Anchoring evidence for ${vehicleId}...`);

    const unixTimestamp = Math.floor(new Date(timestamp).getTime() / 1000);

    // Step 1: Sign the evidence digest (ECDSA non-repudiation)
    const { signature, signerAddress } = await signEvidenceHash(hash, cid, vehicleId, unixTimestamp);

    // Step 2: Check for duplicate hash
    let isDuplicate = false;
    try {
        isDuplicate = await contract.isHashAnchored(hash);
        if (isDuplicate) {
            console.warn(`⚠️  [BlockchainService] Duplicate hash detected — DuplicateHashWarning will be emitted on-chain.`);
        }
    } catch (e) {
        console.warn('⚠️  [BlockchainService] Duplicate check failed (non-critical):', e.message);
    }

    // Step 3: Submit with signature
    const tx = await contract.addEvidenceRecord(cid, hash, vehicleId, unixTimestamp, signature);
    console.log(`⛓️  [BlockchainService] TX submitted: ${tx.hash} — awaiting confirmation...`);

    const receipt = await tx.wait();
    const confirmationMs = Date.now() - txStart;

    const gasUsed = receipt.gasUsed !== undefined ? Number(receipt.gasUsed) : null;

    console.log(`✅ [BlockchainService] Confirmed in block ${receipt.blockNumber}`);
    console.log(`   TX Hash    : ${tx.hash}`);
    console.log(`   Gas Used   : ${gasUsed?.toLocaleString() ?? 'N/A'} units`);
    console.log(`   Conf. Time : ${confirmationMs} ms`);
    console.log(`   Signature  : ${signature.slice(0, 18)}...`);
    console.log(`   Duplicate  : ${isDuplicate}`);

    return {
        txHash:         tx.hash,
        blockNumber:    receipt.blockNumber,
        gasUsed,
        confirmationMs,
        signature,
        signerAddress,
        isDuplicate,
    };
};

// ── Chain of Custody ──────────────────────────────────────────────────────────

/**
 * Log a custody event on-chain.
 * @param {number} recordIndex - On-chain record index
 * @param {number} action      - CustodyAction enum (0-5)
 * @param {string} detail      - Human-readable description
 */
exports.logCustodyEvent = async (recordIndex, action, detail) => {
    console.log(`📋 [BlockchainService] Logging custody event for record ${recordIndex}...`);
    const tx = await contract.logCustodyEvent(recordIndex, action, detail);
    const receipt = await tx.wait();
    console.log(`✅ [BlockchainService] Custody event logged. Gas: ${receipt.gasUsed.toString()}`);
    return { txHash: tx.hash, gasUsed: Number(receipt.gasUsed) };
};

/**
 * Transfer custody of a record to a new custodian.
 */
exports.transferCustody = async (recordIndex, newCustodian, detail) => {
    console.log(`🔄 [BlockchainService] Transferring custody of record ${recordIndex} to ${newCustodian}...`);
    const tx = await contract.transferCustody(recordIndex, newCustodian, detail);
    const receipt = await tx.wait();
    console.log(`✅ [BlockchainService] Custody transferred. Gas: ${receipt.gasUsed.toString()}`);
    return { txHash: tx.hash, gasUsed: Number(receipt.gasUsed) };
};

// ── RBAC ──────────────────────────────────────────────────────────────────────

exports.grantRole = async (account, role) => {
    const tx = await contract.grantRole(account, role);
    const receipt = await tx.wait();
    console.log(`✅ [BlockchainService] Role ${role} granted to ${account}. Gas: ${receipt.gasUsed.toString()}`);
    return { txHash: tx.hash, gasUsed: Number(receipt.gasUsed) };
};

exports.revokeRole = async (account) => {
    const tx = await contract.revokeRole(account);
    const receipt = await tx.wait();
    console.log(`✅ [BlockchainService] Role revoked for ${account}. Gas: ${receipt.gasUsed.toString()}`);
    return { txHash: tx.hash, gasUsed: Number(receipt.gasUsed) };
};

exports.getRole = async (account) => {
    return Number(await contract.getRole(account));
};

// ── Queries ───────────────────────────────────────────────────────────────────

exports.getRecordFromChain = async (index) => {
    const [cid, jsonHash, vehicleId, timestamp, uploadedBy, signature] =
        await contract.getRecord(index);
    return { cid, jsonHash, vehicleId, timestamp: Number(timestamp), uploadedBy, signature };
};

exports.verifyCID = async (cid) => {
    const [found, index] = await contract.verifyCID(cid);
    return { found, index: Number(index) };
};

exports.verifyRecordSignature = async (index) => {
    const [valid, signer] = await contract.verifyRecordSignature(index);
    return { valid, signer };
};

exports.getCustodyInfo = async (index) => {
    const [custodian, status] = await contract.getCustodyInfo(index);
    return { custodian, status: Number(status) };
};

exports.isHashAnchored = async (hash) => {
    return contract.isHashAnchored(hash);
};

exports.getTotalRecords = async () => {
    return Number(await contract.getTotalRecords());
};