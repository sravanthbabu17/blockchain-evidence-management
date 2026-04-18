const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 🛡️ Robust Firestore Configuration
admin.firestore().settings({ ignoreUndefinedProperties: true });

module.exports = admin;
