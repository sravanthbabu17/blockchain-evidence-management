/**
 * signatureService.js — ECDSA Evidence Signing (Non-Repudiation Layer)
 * ---------------------------------------------------------------------
 * Signs evidence digests with the backend wallet's private key.
 * The signature is verified ON-CHAIN by the smart contract via ecrecover.
 *
 * Digest format (must match Solidity):
 *   keccak256(abi.encodePacked(jsonHash, cid, vehicleId, timestamp))
 *
 * Research contribution: cryptographic non-repudiation — the submitter
 * provably signed the data. Invalid signatures are rejected on-chain.
 */

'use strict';

const { ethers } = require('ethers');
require('dotenv').config();

if (!process.env.PRIVATE_KEY) {
    console.error('❌ [SignatureService] PRIVATE_KEY missing in .env');
}

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

/**
 * Sign an evidence digest using the backend wallet.
 * @param {string} jsonHash   - SHA-256 hex digest of the JSON payload
 * @param {string} cid        - IPFS CID of the evidence
 * @param {string} vehicleId  - Vehicle identifier
 * @param {number} timestamp  - Unix timestamp (seconds)
 * @returns {{ signature: string, digest: string, signerAddress: string }}
 */
exports.signEvidenceHash = async (jsonHash, cid, vehicleId, timestamp) => {
    // Must match Solidity: keccak256(abi.encodePacked(jsonHash, cid, vehicleId, timestamp))
    const digest = ethers.solidityPackedKeccak256(
        ["string", "string", "string", "uint256"],
        [jsonHash, cid, vehicleId, timestamp]
    );

    // ethers signMessage auto-prepends "\x19Ethereum Signed Message:\n32"
    const signature = await wallet.signMessage(ethers.getBytes(digest));

    console.log(`🔏 [SignatureService] Evidence signed by ${wallet.address}`);
    console.log(`   Digest : ${digest.slice(0, 18)}...`);
    console.log(`   Sig    : ${signature.slice(0, 18)}...`);

    return {
        signature,
        digest,
        signerAddress: wallet.address
    };
};

/**
 * Verify a signature matches the expected signer.
 * @param {string} digest           - The original digest that was signed
 * @param {string} signature        - The 65-byte ECDSA signature
 * @param {string} expectedAddress  - The expected signer address
 * @returns {boolean}
 */
exports.verifySignature = (digest, signature, expectedAddress) => {
    try {
        const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature);
        const valid = recovered.toLowerCase() === expectedAddress.toLowerCase();
        console.log(`🔍 [SignatureService] Verify: recovered=${recovered}, expected=${expectedAddress}, valid=${valid}`);
        return valid;
    } catch (err) {
        console.error('❌ [SignatureService] Verification failed:', err.message);
        return false;
    }
};

/**
 * Get the wallet address used for signing.
 */
exports.getSignerAddress = () => wallet.address;
