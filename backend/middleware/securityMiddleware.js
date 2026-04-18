'use strict';

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);

const parseOrigins = () => {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    if (configured.length > 0) return configured;

    return [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.56.1:3000',
        'https://localhost:3000',
        'https://127.0.0.1:3000',
        'https://localhost:3001',
        'https://127.0.0.1:3001',
    ];

};

const allowedOrigins = parseOrigins();

exports.corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: false,
    maxAge: 600,
};

exports.securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};

exports.rateLimit = (name, maxRequests) => {
    const buckets = new Map();
    const limit = Number(maxRequests);

    return (req, res, next) => {
        const now = Date.now();
        const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
        const bucket = buckets.get(key);

        if (!bucket || now > bucket.resetAt) {
            buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
            return next();
        }

        bucket.count += 1;
        if (bucket.count > limit) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Try again later.',
            });
        }

        next();
    };
};
