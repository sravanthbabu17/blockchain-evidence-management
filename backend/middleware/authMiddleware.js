const admin = require("../config/firebaseAdmin");

const verifyFirebaseToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    
    // 🔥 Server-Side Role Fetching (The Security Link)
    const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
    
    if (!userDoc.exists) {
      return res.status(403).json({ success: false, message: "Identity not registered in Firestore database" });
    }

    const userData = userDoc.data();
    
    req.user = {
      ...decoded,
      email: decoded.email,
      role: userData.role || "investigator",
      vehicle_id: userData.vehicle_id || null
    };

    next();

  } catch (err) {
    console.error("Token error:", err);
    res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = verifyFirebaseToken;