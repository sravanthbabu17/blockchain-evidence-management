require('dotenv').config();
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const selfsigned = require('selfsigned');
const app = require('./app');

const HTTP_PORT  = Number(process.env.PORT || 5000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 5443);
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Start Servers ─────────────────────────────────────────────────────────────

(async () => {
    // ── SSL/TLS Setup (Self-Signed for Prototype) ────────────────────────────────
    const certDir = path.join(__dirname, 'certs');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

    const keyPath  = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');

    let options = {};

    if (process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH) {
        options = {
            key:  fs.readFileSync(process.env.TLS_KEY_PATH),
            cert: fs.readFileSync(process.env.TLS_CERT_PATH)
        };
    } else if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        options = {
            key:  fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    } else if (IS_PROD) {
        throw new Error('TLS_KEY_PATH and TLS_CERT_PATH are required in production.');
    } else {
        console.log('🛡️  [Server] Generating self-signed TLS certificate (async)...');
        const attrs = [{ name: 'commonName', value: 'localhost' }];
        const pems  = await selfsigned.generate(attrs, { days: 365 });
        
        fs.writeFileSync(keyPath,  pems.private);
        fs.writeFileSync(certPath, pems.cert);
        
        options = {
            key:  pems.private,
            cert: pems.cert
        };
    }

    // 1. Standard HTTP (development only unless explicitly enabled)
    if (!IS_PROD || process.env.ENABLE_HTTP === 'true') {
        http.createServer(app).listen(HTTP_PORT, () => {
            console.log(`🚀 [HTTP]  Server running on http://localhost:${HTTP_PORT}`);
        });
    }

    // 2. Secure HTTPS (Port 5443)
    https.createServer(options, app).listen(HTTPS_PORT, () => {
        console.log(`🔒 [HTTPS] Server running on https://localhost:${HTTPS_PORT}`);
        console.log(`   Note: Use 'https://<local-ip>:5443' for ESP32 secure reporting.`);
    });
})();
