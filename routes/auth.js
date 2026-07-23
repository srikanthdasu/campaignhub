const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db/db");

// ==========================
// REGISTER
// ==========================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({
        success: false,
        message: "Please fill all fields"
      });
    }

    // Check existing user
    const existing = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: "Email already exists"
      });
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    await db.query(
      `INSERT INTO users(name,email,password)
       VALUES($1,$2,$3)`,
      [name, email, hashedPassword]
    );

    res.json({
      success: true,
      message: "Registration successful"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ==========================
// LOGIN
// ==========================
router.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const result = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid email"
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return res.json({
        success: false,
        message: "Wrong password"
      });
    }

    res.json({
      success: true,
      message: "Login successful",
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
});


// ==========================
// LIST USERS (TEST)
// ==========================
router.get("/users", async (req, res) => {

  try {

    const users = await db.query(
      "SELECT id,name,email,created_at FROM users ORDER BY id"
    );

    res.json(users.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});

module.exports = router;