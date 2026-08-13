const db = require("../db/db");

// Reusable helper: insert a notification for a user.
// Other services (scheduler, content planner, etc.) can call this
// instead of duplicating the INSERT query everywhere.
async function notify(userId, message) {
    await db.query(
        `INSERT INTO notifications (user_id, message)
         VALUES ($1, $2)`,
        [userId, message]
    );
}

module.exports = { notify };
