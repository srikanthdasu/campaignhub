const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { requireFields } = require("../middleware/validate");

// Debug (temporary)
console.log("Auth Controller:", authController);

router.post(
    "/register",
    requireFields(["name", "email", "password"]),
    authController.register
);

router.post(
    "/login",
    requireFields(["email", "password"]),
    authController.login
);

router.post("/logout", authController.logout);

router.get("/me", authController.me);

module.exports = router;