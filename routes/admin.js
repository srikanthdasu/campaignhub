const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const requireAdmin = require("../middleware/admin");

router.get("/stats", requireAdmin, adminController.getStats);
router.get("/users", requireAdmin, adminController.getUsers);
router.get("/captions", requireAdmin, adminController.getCaptions);
router.get("/scheduled-posts", requireAdmin, adminController.getScheduledPosts);
router.delete("/users/:id", requireAdmin, adminController.deleteUser);

module.exports = router;
