const VALID_API_KEYS = [
    "device123",   // you can add multiple later
    "vehicle001",
    "SECURE_IOT_KEY_2026"
];

module.exports = (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: "API key missing"
            });
        }

        if (!VALID_API_KEYS.includes(apiKey)) {
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