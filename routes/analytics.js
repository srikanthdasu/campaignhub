const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

// Dashboard summary
router.get("/dashboard", analyticsController.dashboardAnalytics);

// Existing Analytics
router.get("/by-platform", analyticsController.platformAnalytics);

router.get("/daily", analyticsController.dailyAnalytics);

router.get("/top-prompts", analyticsController.topPrompts);

module.exports = router;