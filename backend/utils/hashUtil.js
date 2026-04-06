// backend/utils/hashUtil.js

const crypto = require('crypto');

exports.generateHash = (data) => {
    try {
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
    } catch (error) {
        throw new Error('Hash generation failed');
    }
};