const db = require("../db/db");

async function getCalendarPosts(userId) {
    const result = await db.query(
        `SELECT id, platform, caption, schedule_time, status
         FROM scheduled_posts
         WHERE user_id = $1
         ORDER BY schedule_time ASC`,
        [userId]
    );
    return result.rows;
}

async function updateSchedule(id, scheduleTime) {
    await db.query(
        `UPDATE scheduled_posts SET schedule_time = $1 WHERE id = $2`,
        [scheduleTime, id]
    );
}

async function updateCaption(id, caption) {
    await db.query(
        `UPDATE scheduled_posts SET caption = $1 WHERE id = $2`,
        [caption, id]
    );
}

async function deleteScheduledPost(id) {
    await db.query(`DELETE FROM scheduled_posts WHERE id = $1`, [id]);
}

module.exports = {
    getCalendarPosts,
    updateSchedule,
    updateCaption,
    deleteScheduledPost
};
