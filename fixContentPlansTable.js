const db = require("./db/db");

async function fixTable() {

    try {

        await db.query(`
            ALTER TABLE content_plans
            ALTER COLUMN business DROP NOT NULL;

            ALTER TABLE content_plans
            ALTER COLUMN month DROP NOT NULL;

            ALTER TABLE content_plans
            ALTER COLUMN goal DROP NOT NULL;

            ALTER TABLE content_plans
            ALTER COLUMN plan DROP NOT NULL;
        `);

        console.log("✅ content_plans table fixed");

    } catch (err) {

        console.error(err);

    }

    process.exit();

}

fixTable();