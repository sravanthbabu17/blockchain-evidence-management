const axios = require('axios');
require('dotenv').config();

exports.uploadJSONToIPFS = async (jsonData) => {
    try {
        console.log("📤 Pinning Evidence to IPFS (Axios Engine)...");
        
        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            jsonData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    pinata_api_key: process.env.PINATA_API_KEY,
                    pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
                }
            }
        );

        const cid = response.data.IpfsHash;
        console.log("✅ IPFS Upload SUCCESS:", cid);
        return cid;

    } catch (error) {
        console.error("❌ IPFS Upload Failed:");
        console.error("   Status:", error.response?.status);
        console.error("   Reason:", error.response?.data || error.message);
        throw error;
    }
};