const db = require("../db/db");

exports.getCaptionHistory = async (req, res) => {
    try {

        const { userId } = req.params;

        const result = await db.query(
            `SELECT *
             FROM captions
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            captions: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch captions."
        });

    }
};

exports.deleteCaption = async (req, res) => {
    try {

        await db.query(
            "DELETE FROM captions WHERE id=$1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Caption deleted successfully."
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Delete failed."
        });
    }
};

exports.generateCaption = async (req, res) => {
    res.json({
        success: true,
        message: "Use your existing AI generate route."
    });
};