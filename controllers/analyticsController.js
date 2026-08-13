const db = require("../db/db");

// Platform Analytics
exports.platformAnalytics = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT platform, COUNT(*) AS total
            FROM captions
            GROUP BY platform
            ORDER BY total DESC
        `);

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Daily Analytics
exports.dailyAnalytics = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT DATE(created_at) AS day,
                   COUNT(*) AS total
            FROM captions
            GROUP BY day
            ORDER BY day
        `);

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Top Prompts
exports.topPrompts = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT prompt,
                   COUNT(*) AS total
            FROM captions
            GROUP BY prompt
            ORDER BY total DESC
            LIMIT 5
        `);

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Dashboard Summary
exports.dashboardAnalytics = async (req, res) => {

    try {

        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in."
            });
        }

        const captions = await db.query(
            "SELECT COUNT(*) FROM captions WHERE user_id = $1",
            [userId]
        );

        const images = await db.query(
            "SELECT COUNT(*) FROM images WHERE user_id = $1",
            [userId]
        );

        const plans = await db.query(
            "SELECT COUNT(*) FROM content_plans WHERE user_id = $1",
            [userId]
        );

        const scheduled = await db.query(
            "SELECT COUNT(*) FROM scheduled_posts WHERE user_id = $1",
            [userId]
        );

        res.json({
            success: true,
            analytics: {
                captions: Number(captions.rows[0].count),
                images: Number(images.rows[0].count),
                plans: Number(plans.rows[0].count),
                scheduled: Number(scheduled.rows[0].count)
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};