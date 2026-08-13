const OpenAI = require("openai");

// Azure AI Foundry exposes an OpenAI-compatible endpoint, so we can use the
// official openai SDK pointed at FOUNDRY_ENDPOINT with FOUNDRY_API_KEY.
const client = new OpenAI({
    baseURL: process.env.FOUNDRY_ENDPOINT,
    apiKey: process.env.FOUNDRY_API_KEY
});

/**
 * Generate a social media caption using the configured AI model.
 * @param {string} prompt - what the user wants the caption to be about
 * @param {string} platform - e.g. "Instagram", "LinkedIn", "Facebook"
 * @returns {Promise<string>} the generated caption text
 */
async function generateCaption(prompt, platform = "Instagram") {
    if (!prompt) {
        throw new Error("Prompt is required to generate a caption.");
    }

    const systemPrompt = `You are a professional social media copywriter. Write a short, engaging ${platform} caption (with relevant hashtags where appropriate) based on the user's request. Keep it concise and platform-appropriate. Return only the caption text, nothing else.`;

    const response = await client.chat.completions.create({
        model: process.env.MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.8
    });

    const caption = response.choices?.[0]?.message?.content?.trim();

    if (!caption) {
        throw new Error("AI did not return a caption.");
    }

    return caption;
}

module.exports = generateCaption;
