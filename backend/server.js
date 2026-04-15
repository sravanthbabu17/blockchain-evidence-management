require('dotenv').config();
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const selfsigned = require('selfsigned');
const app = require('./app');

const HTTP_PORT  = 5000;
const HTTPS_PORT = 5443;

// ── SSL/TLS Setup (Self-Signed for Prototype) ────────────────────────────────
const certDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

const keyPath  = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

let options = {};

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    options = {
        key:  fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
} else {
    console.log('🛡️  [Server] Generating self-signed TLS certificate...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems  = selfsigned.generate(attrs, { days: 365 });
    
    fs.writeFileSync(keyPath,  pems.private);
    fs.writeFileSync(certPath, pems.cert);
    
    options = {
        key:  pems.private,
        cert: pems.cert
    };
}

// ── Start Servers ─────────────────────────────────────────────────────────────

// 1. Standard HTTP (Port 5000)
http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`🚀 [HTTP]  Server running on http://localhost:${HTTP_PORT}`);
});

// 2. Secure HTTPS (Port 5443)
https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.log(`🔒 [HTTPS] Server running on https://localhost:${HTTPS_PORT}`);
    console.log(`   Note: Use 'https://<local-ip>:5443' for ESP32 secure reporting.`);
});