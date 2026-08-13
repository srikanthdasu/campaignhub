// ============================================================
// CampaignHub AI
// Professional Image Prompt Enhancement Service
// ============================================================

"use strict";


// ============================================================
// Configuration
// ============================================================

const DEFAULT_SETTINGS = {

    quality:
        "high-quality professional visual",

    lighting:
        "natural, balanced, cinematic lighting",

    composition:
        "strong subject focus, balanced composition, clear visual hierarchy",

    detail:
        "highly detailed, realistic textures, clean details",

    photography:
        "professional commercial photography",

    background:
        "clean, visually appropriate background",

    socialMedia:
        "visually engaging and suitable for social media marketing"

};


// ============================================================
// Main Function
// ============================================================

function enhanceImagePrompt(userPrompt, options = {}) {

    // --------------------------------------------------------
    // Validate input
    // --------------------------------------------------------

    if (
        typeof userPrompt !== "string" ||
        !userPrompt.trim()
    ) {

        throw new Error(
            "Image prompt is required."
        );

    }


    const prompt =
        userPrompt
            .trim()
            .replace(/\s+/g, " ");


    // --------------------------------------------------------
    // Optional settings
    // --------------------------------------------------------

    const platform =
        options.platform || "general";

    const style =
        options.style || "realistic";

    const mood =
        options.mood || "warm and visually appealing";


    // --------------------------------------------------------
    // Detect common user intentions
    // --------------------------------------------------------

    const intent =
        detectIntent(prompt);


    // --------------------------------------------------------
    // Build professional instruction
    // --------------------------------------------------------

    const sections = [];


    sections.push(
        `Create a ${DEFAULT_SETTINGS.quality} based on the user's idea below.`
    );


    sections.push(
        `USER IDEA: "${prompt}"`
    );


    sections.push(
        `Interpret the user's idea naturally while preserving the original meaning, subject, people, setting, and requested purpose.`
    );


    // --------------------------------------------------------
    // Intent-specific direction
    // --------------------------------------------------------

    sections.push(
        getIntentInstruction(intent)
    );


    // --------------------------------------------------------
    // Visual style
    // --------------------------------------------------------

    sections.push(
        `VISUAL STYLE: ${getStyleInstruction(style)}`
    );


    // --------------------------------------------------------
    // Mood
    // --------------------------------------------------------

    sections.push(
        `MOOD: ${mood}.`
    );


    // --------------------------------------------------------
    // Platform optimization
    // --------------------------------------------------------

    sections.push(
        getPlatformInstruction(platform)
    );


    // --------------------------------------------------------
    // Professional quality
    // --------------------------------------------------------

    sections.push(
        `
QUALITY REQUIREMENTS:
- ${DEFAULT_SETTINGS.quality}
- ${DEFAULT_SETTINGS.lighting}
- ${DEFAULT_SETTINGS.composition}
- ${DEFAULT_SETTINGS.detail}
- ${DEFAULT_SETTINGS.photography}
- ${DEFAULT_SETTINGS.background}
- ${DEFAULT_SETTINGS.socialMedia}
- realistic proportions
- natural-looking subjects
- professional color balance
- visually polished result
- no unnecessary visual clutter
        `.trim()
    );


    // --------------------------------------------------------
    // Text / logo handling
    // --------------------------------------------------------

    sections.push(
        `
TEXT AND BRANDING:
Do not add random text, captions, logos, watermarks,
letters, labels, or typography unless the user explicitly
requests them.
        `.trim()
    );


    // --------------------------------------------------------
    // Safety / intent preservation
    // --------------------------------------------------------

    sections.push(
        `
IMPORTANT:
Do not introduce unrelated people, objects, brands,
locations, events, or concepts that were not requested.
Preserve the user's intended meaning.
        `.trim()
    );


    // --------------------------------------------------------
    // Final prompt
    // --------------------------------------------------------

    return sections
        .filter(Boolean)
        .join("\n\n")
        .trim();

}


// ============================================================
// Intent Detection
// ============================================================

function detectIntent(prompt) {

    const text =
        prompt.toLowerCase();


    // --------------------------------------------------------
    // Festival
    // --------------------------------------------------------

    if (
        /rakhi|raksha bandhan|diwali|deepavali|holi|pongal|onam|navratri|ganesh|ganesha|eid|christmas|festival|festive/.test(text)
    ) {

        return "festival";

    }


    // --------------------------------------------------------
    // Product advertisement
    // --------------------------------------------------------

    if (
        /product|advertisement|advertising|ad campaign|brand promotion|product launch|marketing/.test(text)
    ) {

        return "product-advertisement";

    }


    // --------------------------------------------------------
    // Food
    // --------------------------------------------------------

    if (
        /food|restaurant|cafe|coffee|pizza|burger|cake|dessert|dish|meal|cooking/.test(text)
    ) {

        return "food";

    }


    // --------------------------------------------------------
    // Fashion
    // --------------------------------------------------------

    if (
        /fashion|clothing|dress|saree|shirt|jeans|model|outfit|jewelry|jewellery/.test(text)
    ) {

        return "fashion";

    }


    // --------------------------------------------------------
    // Travel
    // --------------------------------------------------------

    if (
        /travel|tourism|vacation|holiday|beach|mountain|hotel|resort|trip/.test(text)
    ) {

        return "travel";

    }


    // --------------------------------------------------------
    // Birthday / celebration
    // --------------------------------------------------------

    if (
        /birthday|anniversary|wedding|celebration|party|engagement/.test(text)
    ) {

        return "celebration";

    }


    // --------------------------------------------------------
    // Business
    // --------------------------------------------------------

    if (
        /business|office|startup|company|corporate|professional|meeting/.test(text)
    ) {

        return "business";

    }


    // --------------------------------------------------------
    // Social media
    // --------------------------------------------------------

    if (
        /instagram|facebook|linkedin|youtube|twitter|x post|social media|reel/.test(text)
    ) {

        return "social-media";

    }


    // --------------------------------------------------------
    // Portrait
    // --------------------------------------------------------

    if (
        /portrait|headshot|person|man|woman|boy|girl|family|brother|sister/.test(text)
    ) {

        return "portrait";

    }


    // --------------------------------------------------------
    // General
    // --------------------------------------------------------

    return "general";

}


// ============================================================
// Intent Instructions
// ============================================================

function getIntentInstruction(intent) {

    switch (intent) {


        // ----------------------------------------------------
        // Festival
        // ----------------------------------------------------

        case "festival":

            return `
FESTIVAL DIRECTION:
Create an authentic and culturally appropriate festive
scene. Use tasteful traditional decorations, meaningful
festive elements, appropriate colors, natural expressions,
and a warm celebratory atmosphere.

Avoid stereotypes or excessive decorative clutter.
            `.trim();


        // ----------------------------------------------------
        // Product advertisement
        // ----------------------------------------------------

        case "product-advertisement":

            return `
ADVERTISEMENT DIRECTION:
Treat the subject as a premium commercial advertisement.
Make the main product visually dominant and clearly visible.
Use professional product positioning, controlled lighting,
premium composition, clean background separation, and
commercial advertising aesthetics.
            `.trim();


        // ----------------------------------------------------
        // Food
        // ----------------------------------------------------

        case "food":

            return `
FOOD PHOTOGRAPHY DIRECTION:
Make the food visually appetizing and realistic.
Use professional food photography, natural textures,
careful presentation, appropriate depth of field,
tasteful props, and attractive lighting.
            `.trim();


        // ----------------------------------------------------
        // Fashion
        // ----------------------------------------------------

        case "fashion":

            return `
FASHION DIRECTION:
Use polished editorial fashion photography.
Preserve realistic anatomy, natural fabric textures,
appropriate styling, flattering composition, and
professional lighting.
            `.trim();


        // ----------------------------------------------------
        // Travel
        // ----------------------------------------------------

        case "travel":

            return `
TRAVEL DIRECTION:
Create an immersive travel photograph with a strong sense
of place. Show realistic environmental details, natural
lighting, attractive composition, depth, and atmosphere.
            `.trim();


        // ----------------------------------------------------
        // Celebration
        // ----------------------------------------------------

        case "celebration":

            return `
CELEBRATION DIRECTION:
Create a joyful and emotionally warm celebration scene.
Use realistic expressions, tasteful decorations, natural
interaction between people, and a memorable composition.
            `.trim();


        // ----------------------------------------------------
        // Business
        // ----------------------------------------------------

        case "business":

            return `
BUSINESS DIRECTION:
Use a polished professional commercial aesthetic.
Create a clean, modern, trustworthy visual appropriate
for a professional brand or business campaign.
            `.trim();


        // ----------------------------------------------------
        // Social media
        // ----------------------------------------------------

        case "social-media":

            return `
SOCIAL MEDIA DIRECTION:
Create an immediately engaging visual with a strong focal
point. Keep the composition clean and recognizable at
social-media thumbnail size.
            `.trim();


        // ----------------------------------------------------
        // Portrait
        // ----------------------------------------------------

        case "portrait":

            return `
PORTRAIT DIRECTION:
Create a natural professional portrait with realistic
facial features, natural skin texture, believable
lighting, appropriate expression, and clean composition.
            `.trim();


        // ----------------------------------------------------
        // General
        // ----------------------------------------------------

        default:

            return `
GENERAL DIRECTION:
Interpret the idea creatively and produce a polished,
professional visual while staying faithful to the user's
original request.
            `.trim();

    }

}


// ============================================================
// Style Instructions
// ============================================================

function getStyleInstruction(style) {

    switch (
        style.toLowerCase()
    ) {


        case "realistic":

            return `
realistic photography, natural materials, believable
lighting, realistic textures and proportions
            `.trim();


        case "cinematic":

            return `
cinematic photography, dramatic but natural lighting,
depth, atmospheric composition, professional film aesthetic
            `.trim();


        case "illustration":

            return `
professional digital illustration, clean shapes,
refined details, polished composition
            `.trim();


        case "3d":

            return `
high-quality 3D render, realistic materials,
professional studio lighting, polished details
            `.trim();


        case "minimal":

            return `
minimalist professional design, clean composition,
limited visual clutter, elegant presentation
            `.trim();


        default:

            return `
professional ${style} visual style
            `.trim();

    }

}


// ============================================================
// Platform Instructions
// ============================================================

function getPlatformInstruction(platform) {

    switch (
        platform.toLowerCase()
    ) {


        case "instagram":

            return `
PLATFORM:
Optimize the composition for Instagram.
Use a strong central subject and visually engaging framing.
            `.trim();


        case "facebook":

            return `
PLATFORM:
Optimize the composition for Facebook feed viewing.
Prioritize clear subject visibility and an engaging scene.
            `.trim();


        case "linkedin":

            return `
PLATFORM:
Use a professional visual style suitable for LinkedIn.
Keep the image polished, credible, and business appropriate.
            `.trim();


        case "youtube":

            return `
PLATFORM:
Create a strong visual suitable for YouTube content
and thumbnail-style presentation.
            `.trim();


        case "x":

            return `
PLATFORM:
Create a clean, attention-grabbing visual suitable for
an X social media post.
            `.trim();


        default:

            return `
PLATFORM:
Create a versatile visual suitable for general social
media marketing.
            `.trim();

    }

}


// ============================================================
// Export
// ============================================================

module.exports = {

    enhanceImagePrompt,

    detectIntent

};