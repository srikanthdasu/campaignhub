const db = require("../db/db");
const generateCaption = require("../routes/generate");

// ========================================
// AI Content Planner (Existing)
// ========================================

async function generatePlan({ user_id, business, month, goal }) {

    const prompt = `
Create a 4-week social media content plan
for a business called "${business}"
for the month of ${month}.
The goal is: ${goal}.
For each week give a theme and 2-3 post ideas.
Keep it concise.
`;

    const planText = await generateCaption(prompt, "Content Plan");

    const plan = {
        business,
        month,
        goal,
        details: planText
    };

    const result = await db.query(

        `INSERT INTO content_plans
        (user_id,business,month,goal,plan)
        VALUES($1,$2,$3,$4,$5)
        RETURNING id,business,month,goal,plan,created_at`,

        [
            user_id,
            business,
            month,
            goal,
            JSON.stringify(plan)
        ]

    );

    return result.rows[0];

}

// ========================================
// Get AI Plans
// ========================================

async function getPlans(userId) {

    const result = await db.query(

        `SELECT
            id,
            business,
            month,
            goal,
            plan,
            created_at
         FROM content_plans
         WHERE user_id=$1
         ORDER BY created_at DESC`,

        [userId]

    );

    return result.rows;

}

// ========================================
// Delete Plan
// ========================================

async function deletePlan(id) {

    await db.query(

        `DELETE FROM content_plans
         WHERE id=$1`,

        [id]

    );

}

// ========================================
// CampaignHub Planner
// ========================================

async function savePlan(data) {

    const result = await db.query(

        `INSERT INTO content_plans
        (
            user_id,
            campaign,
            platform,
            type,
            caption_id,
            image_id,
            publish_date,
            status
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,

[
    Number(data.user_id),
    data.campaign,
    data.platform,
    data.type,
    data.caption_id ? Number(data.caption_id) : null,
    data.image_id ? Number(data.image_id) : null,
    data.publish_date || null,
    data.status
]
    );

    return result.rows[0];

}

// ========================================
// Get CampaignHub Plans
// ========================================

async function getCampaignPlans(userId) {

    const result = await db.query(

        `SELECT *
         FROM content_plans
         WHERE user_id=$1
         ORDER BY created_at DESC`,

        [userId]

    );

    return result.rows;

}

// ========================================
// Export
// ========================================

module.exports = {

    generatePlan,

    getPlans,

    deletePlan,

    savePlan,

    getCampaignPlans

};