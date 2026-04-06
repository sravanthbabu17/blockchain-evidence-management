const admin = require('firebase-admin');
const path = require('path');

let db;

try {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();

    console.log("🔥 Firebase initialized successfully");

} catch (error) {
    console.error("❌ Firebase initialization error:", error.message);
}

module.exports = { admin, db };