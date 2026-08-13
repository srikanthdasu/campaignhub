// ============================================================
// CampaignHub AI
// Image Controller
// ============================================================

"use strict";

const db =
    require("../db/db");

const generateAIImage =
    require("../services/imageService");

const {
    enhanceImagePrompt
} = require("../services/promptService");


// ============================================================
// GENERATE IMAGE
// ============================================================

exports.generateImage =
    async (req, res) => {

        try {

            const {
                user_id,
                prompt,
                platform,
                style,
                mood
            } = req.body;


            console.log(
                "=========================================="
            );

            console.log(
                "CAMPAIGNHUB IMAGE REQUEST"
            );

            console.log(
                "=========================================="
            );

            console.log(
                "User ID:",
                user_id
            );

            console.log(
                "Prompt:",
                prompt
            );

            console.log(
                "Platform:",
                platform
            );

            console.log(
                "Style:",
                style
            );

            console.log(
                "Mood:",
                mood
            );


            // ====================================================
            // VALIDATE USER
            // ====================================================

            if (!user_id) {

                return res.status(400).json({

                    success: false,

                    error:
                        "User ID is required."

                });

            }


            // ====================================================
            // VALIDATE PROMPT
            // ====================================================

            if (
                !prompt ||
                typeof prompt !== "string" ||
                !prompt.trim()
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Image prompt is required."

                });

            }


            // ====================================================
            // ENHANCE PROMPT
            // ====================================================

            const enhancedPrompt =
                enhanceImagePrompt(

                    prompt.trim(),

                    {
                        platform:
                            platform ||
                            "general",

                        style:
                            style ||
                            "realistic professional photography",

                        mood:
                            mood ||
                            "warm and joyful"
                    }

                );


            console.log(
                "Original Prompt:",
                prompt
            );

            console.log(
                "Enhanced Prompt:",
                enhancedPrompt
            );


            // ====================================================
            // GENERATE IMAGE
            // ====================================================

            console.log(
                "Starting AI image generation..."
            );


            const imageUrl =
                await generateAIImage(
                    enhancedPrompt
                );


            console.log(
                "AI image generated."
            );

            console.log(
                "Image URL:",
                imageUrl
            );


            // ====================================================
            // VALIDATE IMAGE URL
            // ====================================================

            if (!imageUrl) {

                throw new Error(
                    "Image service did not return an image URL."
                );

            }


            // ====================================================
            // SAVE TO DATABASE
            // ====================================================

            const result =
                await db.query(

                    `INSERT INTO images
                    (
                        user_id,
                        prompt,
                        image_url
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3
                    )
                    RETURNING
                        id,
                        user_id,
                        prompt,
                        image_url`,

                    [
                        user_id,
                        prompt.trim(),
                        imageUrl
                    ]

                );


            console.log(
                "Image saved to database."
            );


            // ====================================================
            // RESPONSE
            // ====================================================

            return res.status(200).json({

                success: true,

                image: result.rows[0],

                image_url:
                    imageUrl,

                prompt:
                    prompt.trim()

            });


        } catch (err) {

            console.error(
                "=========================================="
            );

            console.error(
                "IMAGE CONTROLLER ERROR"
            );

            console.error(
                "=========================================="
            );

            console.error(
                err
            );


            // ====================================================
            // CONTENT SAFETY
            // ====================================================

            const errorMessage =
                err &&
                err.message
                    ? err.message.toLowerCase()
                    : "";


            if (
                errorMessage.includes(
                    "content_safety"
                ) ||
                errorMessage.includes(
                    "content safety"
                ) ||
                errorMessage.includes(
                    "safety"
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "This image request could not be generated. Please try a different description."

                });

            }


            // ====================================================
            // GENERAL ERROR
            // ====================================================

            return res.status(500).json({

                success: false,

                error:
                    err.message ||
                    "Image generation failed. Please try again."

            });

        }

    };


// ============================================================
// GET IMAGE HISTORY
// ============================================================

exports.getHistory =
    async (req, res) => {

        try {

            const userId =
                req.params.userId;


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "User ID is required."

                });

            }


            const result =
                await db.query(

                    `SELECT
                        id,
                        user_id,
                        prompt,
                        image_url
                     FROM images
                     WHERE user_id = $1
                     ORDER BY id DESC`,

                    [
                        userId
                    ]

                );


            return res.status(200).json({

                success: true,

                images:
                    result.rows

            });


        } catch (err) {

            console.error(
                "GET IMAGE HISTORY ERROR:",
                err
            );


            return res.status(500).json({

                success: false,

                error:
                    err.message ||
                    "Failed to load image history."

            });

        }

    };


// ============================================================
// DELETE IMAGE
// ============================================================

exports.deleteImage =
    async (req, res) => {

        try {

            const imageId =
                req.params.id;


            if (!imageId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Image ID is required."

                });

            }


            const result =
                await db.query(

                    `DELETE FROM images
                     WHERE id = $1
                     RETURNING id`,

                    [
                        imageId
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Image not found."

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Image deleted successfully."

            });


        } catch (err) {

            console.error(
                "DELETE IMAGE ERROR:",
                err
            );


            return res.status(500).json({

                success: false,

                error:
                    err.message ||
                    "Failed to delete image."

            });

        }

    };