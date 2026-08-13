const db = require("../db/db");

// ===============================
// Get All Notifications
// ===============================
exports.getNotifications = async (req, res) => {

    try {

        const result = await db.query(`
            SELECT *
            FROM notifications
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            notifications: result.rows
        });

    } catch (err) {

        console.error("Get Notifications Error:", err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

};

// ===============================
// Create Notification
// ===============================
exports.createNotification = async (req, res) => {

    try {

        const { user_id, message } = req.body;

        const result = await db.query(
            `INSERT INTO notifications(user_id, message)
             VALUES($1,$2)
             RETURNING *`,
            [user_id, message]
        );

        res.json({
            success: true,
            notification: result.rows[0]
        });

    } catch (err) {

        console.error("Create Notification Error:", err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

};

// ===============================
// Delete Notification
// ===============================
exports.deleteNotification = async (req, res) => {

    try {

        await db.query(
            `DELETE FROM notifications
             WHERE id=$1`,
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Notification deleted successfully."
        });

    } catch (err) {

        console.error("Delete Notification Error:", err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

};