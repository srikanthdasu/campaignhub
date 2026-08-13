const contentPlannerService = require("../services/contentPlannerService");

// ========================================
// Existing AI Content Planner
// ========================================

exports.generatePlan = async (req, res) => {

    try {

        const { user_id, business, month, goal } = req.body;

        if (!user_id || !business || !month || !goal) {

            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });

        }

        const plan = await contentPlannerService.generatePlan({
            user_id,
            business,
            month,
            goal
        });

        res.json({
            success: true,
            data: plan
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ========================================
// Existing AI Plans
// ========================================

exports.getPlans = async (req, res) => {

    try {

        const plans = await contentPlannerService.getPlans(
            req.params.userId
        );

        res.json({
            success: true,
            data: plans
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ========================================
// Delete AI Plan
// ========================================

exports.deletePlan = async (req, res) => {

    try {

        await contentPlannerService.deletePlan(
            req.params.id
        );

        res.json({
            success: true,
            message: "Content plan deleted successfully."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ========================================
// CampaignHub Planner
// ========================================

exports.savePlan = async (req, res) => {

    try {

        const plan = await contentPlannerService.savePlan(req.body);

        res.json({
            success: true,
            plan
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ========================================
// Get CampaignHub Plans
// ========================================

exports.getCampaignPlans = async (req, res) => {

    try {

        const plans = await contentPlannerService.getCampaignPlans(
            req.params.userId
        );

        res.json({
            success: true,
            plans
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};