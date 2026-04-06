const { db } = require('../config/firebase');

exports.createUserInDB = async ({ uid, email, role }) => {
    try {
        if (!uid || !email || !role) {
            throw new Error("Missing required fields");
        }

        await db.collection('users').doc(uid).set({
            email,
            role,
            createdAt: new Date().toISOString()
        });

        return { uid, email, role };

    } catch (error) {
        throw new Error("Error saving user: " + error.message);
    }
};