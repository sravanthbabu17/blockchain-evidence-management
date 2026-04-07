const axios = require('axios');
require('dotenv').config();

const fs = require('fs');
const FormData = require('form-data');

exports.uploadJSONToIPFS = async (jsonData) => {
    try {
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
        return response.data.IpfsHash;
    } catch (error) {
        throw error;
    }
};

// 🎥 BINARY FILE UPLOAD (For Video Forensics)
exports.uploadFileToIPFS = async (filePath) => {
    try {
        console.log("📤 Pinning Binary Evidence to IPFS...");
        const data = new FormData();
        data.append('file', fs.createReadStream(filePath));

        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinFileToIPFS',
            data,
            {
                maxBodyLength: 'Infinity',
                headers: {
                    ...data.getHeaders(),
                    pinata_api_key: process.env.PINATA_API_KEY,
                    pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
                }
            }
        );

        console.log("✅ IPFS Binary Upload SUCCESS:", response.data.IpfsHash);
        return response.data.IpfsHash;
    } catch (error) {
        console.error("❌ IPFS Binary Upload Failed:", error.response?.data || error.message);
        throw error;
    }
};