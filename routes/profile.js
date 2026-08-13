const express = require("express");
const router = express.Router();

const profileController = require("../controllers/profileController");

// ===============================
// Get Profile
// ===============================
router.get("/:id", profileController.getProfile);

// ===============================
// Update Profile
// ===============================
router.put("/update", profileController.updateProfile);

// ===============================
// Change Password
// ===============================
router.put("/password", profileController.changePassword);

module.exports = router;