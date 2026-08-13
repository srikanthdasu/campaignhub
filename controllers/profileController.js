const db = require("../db/db");
const bcrypt = require("bcryptjs");

// ===============================
// Get Profile
// ===============================
exports.getProfile = async (req, res) => {

    try {

        const id = req.params.id;

        const result = await db.query(
            `SELECT id, name, email, created_at
             FROM users
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ===============================
// Update Profile
// ===============================
exports.updateProfile = async (req, res) => {

    try {

        const userId = req.session.userId;
        const { name } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        await db.query(
            `UPDATE users
             SET name = $1
             WHERE id = $2`,
            [name, userId]
        );

        req.session.userName = name;

        res.json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ===============================
// Change Password
// ===============================
exports.changePassword = async (req, res) => {

    try {

        const userId = req.session.userId;

        const {
            currentPassword,
            newPassword
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const result = await db.query(
            "SELECT password FROM users WHERE id = $1",
            [userId]
        );

        const valid = await bcrypt.compare(
            currentPassword,
            result.rows[0].password
        );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect."
            });
        }

        const hashedPassword =
            await bcrypt.hash(newPassword, 10);

        await db.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashedPassword, userId]
        );

        res.json({
            success: true,
            message: "Password updated successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};