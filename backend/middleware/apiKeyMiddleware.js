const crypto = require('crypto');

const parseKeys = () => {
    const raw = process.env.IOT_API_KEYS || process.env.IOT_API_KEY || '';
    return raw
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
};

const VALID_API_KEYS = parseKeys();

if (VALID_API_KEYS.length === 0) {
    console.error('[API Key] No IOT_API_KEYS configured. Device ingestion routes will reject all requests.');
}

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

module.exports = (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: "API key missing"
            });
        }

        if (!VALID_API_KEYS.some(validKey => safeEqual(apiKey, validKey))) {
            return res.status(403).json({
                success: false,
                message: "Invalid API key"
            });
        }

        next();

    } catch (error) {
        console.error("API Key Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Authentication failed"
        });
    }
};
