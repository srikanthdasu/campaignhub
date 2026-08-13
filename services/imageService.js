const axios = require("axios");

async function generateImage(prompt) {

    try {

        const response = await axios.post(

            `${process.env.IMAGE_ENDPOINT}/mai/v1/images/generations`,

            {
                prompt: prompt,
                model: process.env.IMAGE_MODEL,
                width: 1024,
                height: 1024
            },

            {
                headers: {
                    "api-key": process.env.FOUNDRY_API_KEY,
                    "Content-Type": "application/json"
                },

                timeout: 120000
            }

        );


        // ==========================================
        // Validate Azure response
        // ==========================================

        if (
            !response.data ||
            !response.data.data ||
            response.data.data.length === 0
        ) {

            throw new Error(
                "No image returned from Azure."
            );

        }


        const image =
            response.data.data[0];


        if (!image.b64_json) {

            throw new Error(
                "Azure returned no image data."
            );

        }


        return `data:image/png;base64,${image.b64_json}`;


    } catch (err) {

        console.error(
            "=========================================="
        );

        console.error(
            "AZURE IMAGE ERROR"
        );

        console.error(
            "=========================================="
        );


        if (err.response) {

            console.error(
                "HTTP Status:",
                err.response.status
            );

            console.error(
                "Azure Response:"
            );

            // IMPORTANT:
            // This shows the real Azure error instead of
            // just displaying [Object].

            console.dir(
                err.response.data,
                {
                    depth: null
                }
            );

        } else {

            console.error(
                "Error:",
                err.message
            );

        }


        console.error(
            "=========================================="
        );


        throw err;

    }

}


module.exports = generateImage;