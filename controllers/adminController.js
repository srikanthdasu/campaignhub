const db = require("../db/db");

exports.getStats = async (req, res) => {
    try {

        const users = await db.query("SELECT COUNT(*) FROM users");
        const captions = await db.query("SELECT COUNT(*) FROM captions");
        const scheduler = await db.query("SELECT COUNT(*) FROM scheduled_posts");
        const planner = await db.query("SELECT COUNT(*) FROM content_plans");

        res.json({
            success: true,
            users: Number(users.rows[0].count),
            captions: Number(captions.rows[0].count),
            scheduler: Number(scheduler.rows[0].count),
            planner: Number(planner.rows[0].count)
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};
exports.getUsers = async (req, res) => {
    try {

        const result = await db.query(`
            SELECT
                id,
                name,
                email,
                created_at
            FROM users
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            users: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.getCaptions = async (req, res) => {
    try {

        const result = await db.query(`
            SELECT
                id,
                prompt,
                platform,
                created_at
            FROM captions
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            captions: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.getScheduledPosts = async (req, res) => {
    try {

        const result = await db.query(`
            SELECT
                id,
                platform,
                caption,
                schedule_time,
                status
            FROM scheduled_posts
            ORDER BY schedule_time DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            posts: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};
exports.deleteUser = async (req, res) => {

    try {

        await db.query(
            "DELETE FROM users WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};