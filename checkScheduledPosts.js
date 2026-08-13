require("dotenv").config();

const db = require("./db/db");

(async () => {

    const result = await db.query(`
        SELECT
            column_name,
            data_type
        FROM information_schema.columns
        WHERE table_name='scheduled_posts'
        ORDER BY ordinal_position;
    `);

    console.table(result.rows);

    process.exit();

})();