require("dotenv").config();

const db = require("./db/db");

(async () => {
    try {
        console.log("Updating scheduled_posts table...");

        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS campaign_title TEXT
        `);

        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS image_id INTEGER
        `);

        await db.query(`
            ALTER TABLE scheduled_posts
            ADD COLUMN IF NOT EXISTS image_url TEXT
        `);

        console.log("✅ scheduled_posts table updated successfully.");

        const result = await db.query(`
            SELECT
                column_name,
                data_type
            FROM information_schema.columns
            WHERE table_name = 'scheduled_posts'
            ORDER BY ordinal_position;
        `);

        console.table(result.rows);

    } catch (err) {
        console.error("❌ Database update failed:");
        console.error(err);
    } finally {
        await db.end();
    }
})();