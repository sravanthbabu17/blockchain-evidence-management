const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

async function testKeys() {
    console.log("🔍 TESTING API KEYS...");

    // 1. Test Pinata
    try {
        const res = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
            headers: {
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
            }
        });
        console.log("✅ PINATA: Authenticated Successfully");
    } catch (e) {
        console.error("❌ PINATA: Failed!", e.response?.status, e.response?.data);
    }

    // 2. Test Alchemy
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_URL);
        const network = await provider.getNetwork();
        console.log("✅ ALCHEMY: Connected to", network.name);
    } catch (e) {
        console.error("❌ ALCHEMY: Failed!", e.message);
    }
}

testKeys();
