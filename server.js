require("dotenv").config();

const express = require("express");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const path = require("path");

const db = require("./db/db");
const generateCaption = require("./routes/generate");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/auth", authRoutes);

// ===============================
// Static Files
// ===============================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// Database Test
// ===============================
app.get("/db-test", async (req, res) => {

    try {

        const result = await db.query("SELECT NOW()");

        res.json({
            success: true,
            time: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// ===============================
// Create Users Table
// ===============================
app.get("/create-users-table", async (req, res) => {

    try {

        await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);

        res.send("✅ Users table created successfully!");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});

// ===============================
// Create Captions Table
// ===============================
app.get("/create-captions-table", async (req, res) => {

    try {

        await db.query(`
        CREATE TABLE IF NOT EXISTS captions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            prompt TEXT NOT NULL,
            platform VARCHAR(50),
            caption TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);

        res.send("✅ Captions table created successfully!");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});

// ===============================
// Generate AI Caption + Save
// ===============================
app.post("/api/generate-caption", async (req, res) => {

    try {

        const { user_id, prompt, platform } = req.body;

        if (!prompt) {

            return res.status(400).json({
                success: false,
                error: "Prompt is required"
            });

        }

        // Generate caption using Azure AI
        const caption = await generateCaption(
            prompt,
            platform || "Instagram"
        );

        // Save caption
        await db.query(
            `INSERT INTO captions
            (user_id, prompt, platform, caption)
            VALUES ($1,$2,$3,$4)`,
            [
                user_id,
                prompt,
                platform,
                caption
            ]
        );

        res.json({
            success: true,
            caption
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// ===============================
// View Saved Captions
// ===============================
app.get("/captions", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT * FROM captions ORDER BY id DESC"
        );

        res.json({
            success: true,
            total: result.rows.length,
            captions: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
// ===============================
// Delete Caption
// ===============================
app.delete("/captions/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM captions WHERE id=$1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Caption deleted successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
// ===============================
// Dashboard Statistics API
// ===============================

app.get("/dashboard/stats", async (req, res) => {

    try {

        const totalCaptions = await db.query(
            "SELECT COUNT(*) FROM captions"
        );

        const totalUsers = await db.query(
            "SELECT COUNT(*) FROM users"
        );

        const todayCaptions = await db.query(`
            SELECT COUNT(*)
            FROM captions
            WHERE DATE(created_at) = CURRENT_DATE
        `);

        res.json({

            success: true,

            totalCaptions: Number(totalCaptions.rows[0].count),

            totalUsers: Number(totalUsers.rows[0].count),

            todayCaptions: Number(todayCaptions.rows[0].count)

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            error: "Unable to load dashboard statistics."

        });

    }

});
app.get("/analytics/platforms", async (req, res) => {
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
});

app.get("/analytics/daily", async (req, res) => {
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
});

app.get("/analytics/prompts", async (req, res) => {
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
});
app.get("/profile/:id", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, name, email FROM users WHERE id=$1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
const bcrypt = require("bcryptjs");

app.put("/profile/password", async (req, res) => {

    try {

        const { id, currentPassword, newPassword } = req.body;

        const result = await db.query(
            "SELECT password FROM users WHERE id=$1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const valid = await bcrypt.compare(
            currentPassword,
            result.rows[0].password
        );

        if (!valid) {
            return res.json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            "UPDATE users SET password=$1 WHERE id=$2",
            [hashedPassword, id]
        );

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
app.get("/create-content-planner-table", async (req, res) => {

    try {

        await db.query(`
            CREATE TABLE IF NOT EXISTS content_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                business TEXT NOT NULL,
                month VARCHAR(30),
                plan TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        res.send("✅ Content Planner table created successfully!");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.get("/create-scheduler-table", async (req, res) => {

    try {

        await db.query(`
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                platform VARCHAR(50),
                caption TEXT,
                schedule_time TIMESTAMP,
                status VARCHAR(20) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        res.send("✅ Scheduler table created successfully!");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.post("/scheduler", async (req, res) => {
    try {

        const { user_id, platform, caption, schedule_time } = req.body;

        await db.query(
            `INSERT INTO scheduled_posts
            (user_id, platform, caption, schedule_time)
            VALUES ($1, $2, $3, $4)`,
            [user_id, platform, caption, schedule_time]
        );

        res.json({
            success: true,
            message: "Post scheduled successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
});
app.get("/scheduler", async (req, res) => {

    try {

        const result = await db.query(
            `SELECT *
             FROM scheduled_posts
             ORDER BY schedule_time ASC`
        );

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

});
app.delete("/scheduler/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM scheduled_posts WHERE id=$1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Scheduled post deleted."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
app.get("/reports/scheduler/pdf", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT platform, caption, schedule_time, status
            FROM scheduled_posts
            ORDER BY schedule_time ASC
        `);

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Scheduler.pdf"
        );

        doc.pipe(res);

        doc.fontSize(22).text("CampaignHub AI - Scheduled Posts", {
            align: "center"
        });

        doc.moveDown();

        result.rows.forEach((row, index) => {

            doc.fontSize(14).text(`Post ${index + 1}`, {
                underline: true
            });

            doc.text(`Platform: ${row.platform}`);
            doc.text(`Caption: ${row.caption}`);
            doc.text(
                `Schedule Time: ${new Date(row.schedule_time).toLocaleString()}`
            );
            doc.text(`Status: ${row.status}`);

            doc.moveDown();

        });

        doc.end();

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.get("/reports/scheduler/excel", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT platform, caption, schedule_time, status
            FROM scheduled_posts
            ORDER BY schedule_time ASC
        `);

        const workbook = new ExcelJS.Workbook();

        const sheet = workbook.addWorksheet("Scheduled Posts");

        sheet.columns = [
            { header: "Platform", key: "platform", width: 20 },
            { header: "Caption", key: "caption", width: 60 },
            { header: "Schedule Time", key: "schedule_time", width: 25 },
            { header: "Status", key: "status", width: 15 }
        ];

        result.rows.forEach(row => {
            sheet.addRow(row);
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Scheduler.xlsx"
        );

        await workbook.xlsx.write(res);

        res.end();

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.get("/reports/captions/pdf", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT prompt, platform, caption, created_at
            FROM captions
            ORDER BY created_at DESC
        `);

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Captions.pdf"
        );

        doc.pipe(res);

        doc.fontSize(20).text("CampaignHub AI - Caption Report", {
            align: "center"
        });

        doc.moveDown();

        result.rows.forEach((row, index) => {

            doc.fontSize(14).text(`Caption ${index + 1}`, {
                underline: true
            });

            doc.text(`Prompt: ${row.prompt}`);
            doc.text(`Platform: ${row.platform}`);
            doc.text(`Caption: ${row.caption}`);
            doc.text(`Created: ${new Date(row.created_at).toLocaleString()}`);

            doc.moveDown();

        });

        doc.end();

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.get("/reports/captions/excel", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT prompt, platform, caption, created_at
            FROM captions
            ORDER BY created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Captions");

        sheet.columns = [
            { header: "Prompt", key: "prompt", width: 30 },
            { header: "Platform", key: "platform", width: 20 },
            { header: "Caption", key: "caption", width: 60 },
            { header: "Created At", key: "created_at", width: 25 }
        ];

        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Captions.xlsx"
        );

        await workbook.xlsx.write(res);

        res.end();

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.get("/admin/stats", async (req, res) => {

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

});
app.get("/admin/users", async (req, res) => {

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

});
app.get("/admin/captions", async (req, res) => {

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

});
app.get("/admin/scheduled-posts", async (req, res) => {

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

});
// ===============================
// Delete User (Admin)
// ===============================
app.delete("/admin/user/:id", async (req, res) => {

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

});
app.get("/create-images-table", async (req, res) => {

    try {

        await db.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prompt TEXT NOT NULL,
                image_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        res.send("✅ Images table created successfully!");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.post("/images", async (req, res) => {

    try {

        const {
            user_id,
            prompt,
            image_url
        } = req.body;

        await db.query(
            `INSERT INTO images
            (user_id, prompt, image_url)
            VALUES ($1,$2,$3)`,
            [
                user_id,
                prompt,
                image_url
            ]
        );

        res.json({
            success: true,
            message: "Image saved successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
app.get("/images", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT *
            FROM images
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            images: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
app.delete("/images/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM images WHERE id=$1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Image deleted successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
app.get("/create-notifications-table", async (req, res) => {

    try {

        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'Unread',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        res.send("Notifications table created.");

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }

});
app.post("/notifications", async (req, res) => {

    const { user_id, message } = req.body;

    await db.query(
        `INSERT INTO notifications(user_id,message)
         VALUES($1,$2)`,
        [user_id, message]
    );

    res.json({ success: true });

});
app.get("/notifications/:userId", async (req, res) => {

    const result = await db.query(
        `SELECT *
         FROM notifications
         WHERE user_id=$1
         ORDER BY created_at DESC`,
        [req.params.userId]
    );

    res.json(result.rows);

});
app.put("/notifications/:id", async (req, res) => {

    await db.query(
        `UPDATE notifications
         SET status='Read'
         WHERE id=$1`,
        [req.params.id]
    );

    res.json({ success: true });

});
app.delete("/notifications/:id", async (req, res) => {

    await db.query(
        `DELETE FROM notifications
         WHERE id=$1`,
        [req.params.id]
    );

    res.json({ success: true });

});

app.put("/notifications/:id", async (req, res) => {

    await db.query(
        `UPDATE notifications
         SET status='Read'
         WHERE id=$1`,
        [req.params.id]
    );

    res.json({ success: true });

});

app.delete("/notifications/:id", async (req, res) => {

    await db.query(
        `DELETE FROM notifications
         WHERE id=$1`,
        [req.params.id]
    );

    res.json({ success: true });

});

// ===============================
// Server
// ===============================
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});