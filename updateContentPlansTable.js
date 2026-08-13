const db = require("./db/db");

async function updateTable() {
    try {
        await db.query(`
            ALTER TABLE content_plans
            ADD COLUMN IF NOT EXISTS campaign VARCHAR(255),
            ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
            ADD COLUMN IF NOT EXISTS type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS caption_id INT,
            ADD COLUMN IF NOT EXISTS image_id INT,
            ADD COLUMN IF NOT EXISTS publish_date DATE,
            ADD COLUMN IF NOT EXISTS status VARCHAR(30);
        `);

        console.log("✅ content_plans table updated successfully");
    } catch (err) {
        console.error(err);
    }

    process.exit();
}

updateTable();