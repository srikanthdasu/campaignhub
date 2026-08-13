const bcrypt = require("bcryptjs");
const db = require("../db/db");

// ===============================
// Register
// ===============================
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });
        }

        const existing = await db.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        const user = result.rows[0];

        req.session.userId = user.id;
        req.session.userName = user.name;

        res.json({
            success: true,
            message: "Registered successfully.",
            user
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
// Login
// ===============================
exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        const valid = await bcrypt.compare(
            password,
            user.password
        );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        req.session.userId = user.id;
        req.session.userName = user.name;

        res.json({
            success: true,
            message: "Logged in successfully.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
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

// ===============================
// Logout
// ===============================
exports.logout = (req, res) => {

    req.session.destroy(() => {

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message: "Logged out successfully."
        });

    });

};

// ===============================
// Current User
// ===============================
exports.me = (req, res) => {

    if (!req.session.userId) {

        return res.status(401).json({
            success: false,
            message: "Not logged in."
        });

    }

    res.json({
        success: true,
        user: {
            id: req.session.userId,
            name: req.session.userName
        }
    });

};