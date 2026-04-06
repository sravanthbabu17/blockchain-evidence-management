const { createUserInDB } = require('../services/userService');

exports.registerUser = async (req, res, next) => {
    try {
        const { uid, email, role } = req.body;

        if (!uid || !email || !role) {
            return res.status(400).json({
                success: false,
                message: "All fields required"
            });
        }

        const user = await createUserInDB({ uid, email, role });

        res.status(201).json({
            success: true,
            message: "User registered",
            data: user
        });

    } catch (error) {
        next(error);
    }
};