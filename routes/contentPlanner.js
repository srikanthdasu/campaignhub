const express = require("express");
const router = express.Router();

const contentPlannerController = require("../controllers/contentPlannerController");
const { requireFields } = require("../middleware/validate");

// ========================================
// Existing AI Content Planner
// ========================================

router.post(
    "/",
    requireFields([
        "user_id",
        "business",
        "month",
        "goal"
    ]),
    contentPlannerController.generatePlan
);

router.get(
    "/:userId",
    contentPlannerController.getPlans
);

router.delete(
    "/:id",
    contentPlannerController.deletePlan
);

// ========================================
// CampaignHub Content Planner
// ========================================

// Save Content Plan
router.post(
    "/save",
    contentPlannerController.savePlan
);

// Get Campaign Plans
router.get(
    "/campaign/:userId",
    contentPlannerController.getCampaignPlans
);

module.exports = router;