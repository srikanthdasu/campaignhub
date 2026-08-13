require("dotenv").config();

const express = require("express");
const session = require("express-session");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const path = require("path");

const db = require("./db/db");
const generateCaption = require("./routes/generate");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const notificationRoutes = require("./routes/notifications");
const notificationService = require("./services/notificationService");
const schedulerRoutes = require("./routes/scheduler");
const profileRoutes = require("./routes/profile");
const reportsRoutes = require("./routes/reports");
const analyticsRoutes = require("./routes/analytics");
const contentPlannerRoutes = require("./routes/contentPlanner");
const imageRoutes = require("./routes/images");
const captionRoutes = require("./routes/captions");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware — required for login/register/logout to work
app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true
    }
}));
// ===============================
// Static Files
// ===============================
app.use(express.static(path.join(__dirname, "public")));
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/api/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationRoutes);
app.use("/scheduler", schedulerRoutes);
app.use("/profile", profileRoutes);
app.use("/reports", reportsRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/content-planner", contentPlannerRoutes);
app.use("/images", imageRoutes);
app.use("/captions", captionRoutes);


// ===============================
// Database Test
// ===============================
app.get("/db-test", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");
        res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
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
// Create Scheduled Posts Table
// ===============================
app.get("/create-scheduled-posts-table", async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                platform VARCHAR(50) NOT NULL,
                caption TEXT NOT NULL,
                schedule_time TIMESTAMP NOT NULL,
                status VARCHAR(30) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.json({ success: true, message: "scheduled_posts table created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Create Content Plans Table
// ===============================
app.get("/create-content-plans-table", async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS content_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                business TEXT NOT NULL,
                month VARCHAR(20) NOT NULL,
                goal TEXT NOT NULL,
                plan JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.json({ success: true, message: "content_plans table created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Utility: inspect content_plans columns (kept from your version — handy for debugging)
app.get("/content-plans-columns", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'content_plans'
            ORDER BY ordinal_position
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Utility: patch content_plans if an older version is missing columns (kept from your version)
app.get("/fix-content-plans-table", async (req, res) => {
    try {
        await db.query(`ALTER TABLE content_plans ADD COLUMN IF NOT EXISTS month VARCHAR(20);`);
        await db.query(`ALTER TABLE content_plans ADD COLUMN IF NOT EXISTS goal TEXT;`);
        res.json({ success: true, message: "content_plans table updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Create Notifications Table
// ===============================
app.get("/create-notifications-table", async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.json({ success: true, message: "Notifications table created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Utility: view all notifications (kept from your version)
app.get("/check-notifications", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM notifications ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// Utility: insert a test notification (kept from your version)
app.get("/test-notification", async (req, res) => {
    try {
        await db.query(
            `INSERT INTO notifications(user_id, message) VALUES($1, $2)`,
            [1, "Test notification"]
        );
        res.send("Notification inserted successfully.");
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// ===============================
// Create Images Table
// ===============================
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
        res.json({ success: true, message: "Images table created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Generate AI Caption + Save
// ===============================
app.post("/api/generate-caption", async (req, res) => {
    try {
        const { user_id, prompt, platform } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: "Prompt is required" });
        }

        const caption = await generateCaption(prompt, platform || "Instagram");

        await db.query(
            `INSERT INTO captions (user_id, prompt, platform, caption) VALUES ($1,$2,$3,$4)`,
            [user_id, prompt, platform, caption]
        );

        await notificationService.notify(
            user_id,
            `🤖 AI caption generated successfully for ${platform || "Instagram"}.`
        );

        res.json({ success: true, caption });
    } catch (err) {
        console.error("Generate Caption Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// View Saved Captions
// ===============================
app.get("/captions", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM captions ORDER BY id DESC");
        res.json({ success: true, total: result.rows.length, captions: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Delete Caption (kept from your version)
// ===============================
app.delete("/captions/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM captions WHERE id=$1", [req.params.id]);
        res.json({ success: true, message: "Caption deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Dashboard Statistics API
// ===============================
app.get("/dashboard/stats", async (req, res) => {
    try {
        const totalCaptions = await db.query("SELECT COUNT(*) FROM captions");
        const totalUsers = await db.query("SELECT COUNT(*) FROM users");
        const todayCaptions = await db.query(`
            SELECT COUNT(*) FROM captions WHERE DATE(created_at)=CURRENT_DATE
        `);
        const scheduledPosts = await db.query("SELECT COUNT(*) FROM scheduled_posts");
        const totalPlans = await db.query("SELECT COUNT(*) FROM content_plans");
        const notifications = await db.query("SELECT COUNT(*) FROM notifications");

        res.json({
            success: true,
            totalUsers: Number(totalUsers.rows[0].count),
            totalCaptions: Number(totalCaptions.rows[0].count),
            todayCaptions: Number(todayCaptions.rows[0].count),
            scheduledPosts: Number(scheduledPosts.rows[0].count),
            totalPlans: Number(totalPlans.rows[0].count),
            notifications: Number(notifications.rows[0].count)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===============================
// Debug Users (Temporary)
// ===============================
app.get("/debug/users", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, name, email, password FROM users ORDER BY id"
        );

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
const bcrypt = require("bcryptjs");

app.get("/debug/reset-password", async (req, res) => {
    try {
        const newPassword = "Password123";
        const hash = await bcrypt.hash(newPassword, 10);

        await db.query(
            "UPDATE users SET password = $1 WHERE email = $2",
            [hash, "test@example.com"]
        );

        res.json({
            success: true,
            message: "Password reset successfully.",
            email: "test@example.com",
            password: newPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// ===============================
// 404 + Error handler (keep last)
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

app.use(errorHandler);
// ===============================
// Server
// ===============================
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
// ============================================================
// Ensure scheduled_posts table has required Scheduler columns
// ============================================================

async function ensureSchedulerColumns() {
    try {
        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS campaign_title TEXT
        `);

        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS image_id INTEGER
        `);

        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS image_url TEXT
        `);

        console.log("✅ scheduled_posts columns checked successfully");

    } catch (err) {
        console.error(
            "❌ scheduled_posts table update failed:",
            err.message
        );
    }
}

ensureSchedulerColumns();