const db = require("./db/db");

async function checkTable() {
    try {
        const result = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'content_plans'
            ORDER BY ordinal_position;
        `);

        console.table(result.rows);

    } catch (err) {
        console.error(err);
    }

    process.exit();
}

checkTable();