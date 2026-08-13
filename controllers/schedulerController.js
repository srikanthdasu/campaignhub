const db = require("../db/db");
const schedulerService = require("../services/schedulerService");

// ========================================
// Get Logged-in User ID
// ========================================

function getUserId(req) {

    if (req.session?.user?.id) {
        return req.session.user.id;
    }

    if (req.user?.id) {
        return req.user.id;
    }

    if (req.session?.userId) {
        return req.session.userId;
    }

    if (req.body?.user_id) {
        return req.body.user_id;
    }

    return null;
}


// ========================================
// CREATE SCHEDULE
// ========================================

exports.createSchedule = async (req, res) => {

    try {

        console.log(
            "Create Schedule Body:",
            req.body
        );


        const user_id = getUserId(req);


        // ====================================
        // Authentication
        // ====================================

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "User is not authenticated."
            });

        }


        // ====================================
        // Read frontend values
        // ====================================

        const {
            title,
            campaign_title,
            platform,
            caption_id,
            captionId,
            caption,
            image_id,
            imageId,
            image_url,
            schedule_time,
            date,
            time,
            status
        } = req.body;


        // ====================================
        // Caption ID
        // ====================================

        const finalCaptionId =
            caption_id ||
            captionId ||
            null;


        // ====================================
        // Image ID
        // ====================================

        const finalImageId =
            image_id ||
            imageId ||
            null;


        // ====================================
        // Campaign title
        // ====================================

        const finalCampaignTitle =
            campaign_title ||
            title ||
            "Scheduled Post";


        // ====================================
        // Schedule time
        // ====================================

        let finalScheduleTime =
            schedule_time || null;


        if (
            !finalScheduleTime &&
            date &&
            time
        ) {

            finalScheduleTime =
                `${date} ${time}`;

        }


        // ====================================
        // Validate platform
        // ====================================

        if (!platform) {

            return res.status(400).json({
                success: false,
                message: "Platform is required."
            });

        }


        // ====================================
        // Validate date/time
        // ====================================

        if (!finalScheduleTime) {

            return res.status(400).json({
                success: false,
                message:
                    "Schedule date and time are required."
            });

        }


        // ====================================
        // Get Caption
        // ====================================

        let finalCaption =
            caption || null;


        if (finalCaptionId) {

            const captionResult =
                await db.query(
                    `
                    SELECT caption
                    FROM captions
                    WHERE id = $1
                    AND user_id = $2
                    `,
                    [
                        finalCaptionId,
                        user_id
                    ]
                );


            if (
                captionResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Selected AI caption was not found."
                });

            }


            finalCaption =
                captionResult.rows[0].caption;

        }


        if (!finalCaption) {

            return res.status(400).json({
                success: false,
                message:
                    "Please select an AI caption."
            });

        }


        // ====================================
        // Get Image URL
        // ====================================

        let finalImageUrl =
            image_url || null;


        if (finalImageId) {

            const imageResult =
                await db.query(
                    `
                    SELECT image_url
                    FROM images
                    WHERE id = $1
                    AND user_id = $2
                    `,
                    [
                        finalImageId,
                        user_id
                    ]
                );


            if (
                imageResult.rows.length > 0
            ) {

                finalImageUrl =
                    imageResult.rows[0].image_url;

            }

        }


        // ====================================
        // SAVE SCHEDULE
        // ====================================

        const result =
            await db.query(
                `
                INSERT INTO scheduled_posts
                (
                    user_id,
                    campaign_title,
                    platform,
                    caption,
                    image_id,
                    image_url,
                    schedule_time,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING *
                `,
                [
                    user_id,

                    finalCampaignTitle,

                    platform,

                    finalCaption,

                    finalImageId,

                    finalImageUrl,

                    finalScheduleTime,

                    status || "scheduled"
                ]
            );


        // ====================================
        // SUCCESS
        // ====================================

        return res.json({

            success: true,

            message:
                "Post scheduled successfully.",

            schedule:
                result.rows[0]

        });


    } catch (err) {

        console.error(
            "Create schedule error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ========================================
// GET SCHEDULES
// ========================================

exports.getSchedules = async (req, res) => {

    try {

        const user_id =
            getUserId(req);


        if (!user_id) {

            return res.status(401).json({
                success: false,
                message:
                    "User is not authenticated."
            });

        }


        const result =
            await db.query(
                `
                SELECT
                    id,
                    user_id,
                    campaign_title,
                    platform,
                    caption,
                    image_id,
                    image_url,
                    schedule_time,
                    status,
                    created_at
                FROM scheduled_posts
                WHERE user_id = $1
                ORDER BY schedule_time ASC
                `,
                [user_id]
            );


        return res.json({

            success: true,

            schedules:
                result.rows

        });


    } catch (err) {

        console.error(
            "Get schedules error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ========================================
// CALENDAR
// ========================================

exports.getCalendarPosts = async (req, res) => {

    try {

        const posts =
            await schedulerService.getCalendarPosts(
                req.params.userId
            );


        return res.json({

            success: true,

            data: posts

        });


    } catch (err) {

        console.error(
            "Calendar error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ========================================
// UPDATE SCHEDULE
// ========================================

exports.updateSchedule = async (req, res) => {

    try {

        await schedulerService.updateSchedule(
            req.params.id,
            req.body.schedule_time
        );


        return res.json({

            success: true,

            message:
                "Schedule updated successfully."

        });


    } catch (err) {

        console.error(
            "Update schedule error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ========================================
// UPDATE CAPTION
// ========================================

exports.updateCaption = async (req, res) => {

    try {

        await schedulerService.updateCaption(
            req.params.id,
            req.body.caption
        );


        return res.json({

            success: true,

            message:
                "Caption updated successfully."

        });


    } catch (err) {

        console.error(
            "Update caption error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ========================================
// DELETE SCHEDULE
// ========================================

exports.deleteScheduledPost = async (req, res) => {

    try {

        await schedulerService.deleteScheduledPost(
            req.params.id
        );


        return res.json({

            success: true,

            message:
                "Scheduled post deleted successfully."

        });


    } catch (err) {

        console.error(
            "Delete schedule error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};