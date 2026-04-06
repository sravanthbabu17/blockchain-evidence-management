const { ethers } = require('ethers');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = "0x6775f902993ab3B4F250189Be85558F09e02b7dc";

// ABI (copy minimal ABI)
const ABI = [
    "function addEvidenceRecord(string,string,string,uint256)"
];

// Check env variables first
if (!process.env.ALCHEMY_URL || !process.env.PRIVATE_KEY) {
    console.error("❌ CRITICAL: ALCHEMY_URL or PRIVATE_KEY missing in .env!");
}

// v6 robust initialization
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL, {
    name: 'sepolia',
    chainId: 11155111
});

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

exports.storeOnBlockchain = async ({ cid, hash, vehicleId, timestamp }) => {
    try {
        const tx = await contract.addEvidenceRecord(
            cid,
            hash,
            vehicleId,
            Math.floor(new Date(timestamp).getTime() / 1000)
        );

        await tx.wait();

        console.log("⚓ Blockchain Transaction Success! Hash:", tx.hash);

        return tx.hash;

    } catch (error) {
        console.error("❌ Blockchain error:", error.message);
        if (error.data) console.error("Error data:", error.data);
        throw error; // Re-throw the original error so we can see its message in the controller
    }
};