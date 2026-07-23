require("dotenv").config();
const axios = require("axios");

async function generateCaption(prompt, platform = "Instagram") {

    const aiPrompt = `
You are a social media marketing expert.

Respond ONLY in plain text.

Do NOT write a normal paragraph.

Follow this format exactly.

Short Caption:
<write 2 sentences>

Long Caption:
<write 5-7 sentences>

Hashtags:
#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8 #tag9 #tag10

Call To Action:
<one sentence>

Emoji Version:
<same short caption with emojis>

Product: ${prompt}

Platform: ${platform}
`;

    try {

        const response = await axios.post(

            `${process.env.FOUNDRY_ENDPOINT}/chat/completions`,

            {

                model: process.env.MODEL_NAME,

                messages: [

                    {
                        role: "system",
                        content: "You are an expert social media marketing assistant."
                    },

                    {
                        role: "user",
                        content: aiPrompt
                    }

                ],

                max_tokens: 600,

                temperature: 0.8

            },

            {

                headers: {

                    "api-key": process.env.FOUNDRY_API_KEY,

                    "Content-Type": "application/json"

                }

            }

        );

        return response.data.choices[0].message.content;

    } catch (err) {

        console.error("Status:", err.response?.status);
        console.error("Data:", JSON.stringify(err.response?.data, null, 2));

        throw err;

    }

}

module.exports = generateCaption;