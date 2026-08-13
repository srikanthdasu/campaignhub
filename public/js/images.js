"use strict";

let currentUser = null;


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("====================================");
    console.log("CAMPAIGNHUB IMAGE PAGE");
    console.log("images.js loaded successfully");
    console.log("====================================");

    try {

        const response = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include"
        });

        console.log("AUTH ME STATUS:", response.status);

        if (response.ok) {

            const data = await response.json();

            console.log("AUTH ME:", data);

            if (data.success && data.user) {

                currentUser = data.user;

                localStorage.setItem(
                    "user",
                    JSON.stringify(currentUser)
                );

            }
        }

    } catch (error) {

        console.error("Auth request error:", error);

    }


    // --------------------------------------------------------
    // Fallback localStorage
    // --------------------------------------------------------

    if (!currentUser || !currentUser.id) {

        try {

            currentUser = JSON.parse(
                localStorage.getItem("user")
            );

        } catch (error) {

            console.error(
                "localStorage user error:",
                error
            );

        }

    }


    // --------------------------------------------------------
    // Check login
    // --------------------------------------------------------

    if (!currentUser || !currentUser.id) {

        alert("Please login first.");

        window.location.href = "/login.html";

        return;

    }


    console.log("CURRENT USER:", currentUser);


    // --------------------------------------------------------
    // IMPORTANT:
    // Match HTML id="generateImageBtn"
    // --------------------------------------------------------

    const generateButton =
        document.getElementById("generateImageBtn");


    if (!generateButton) {

        console.error(
            "ERROR: #generateImageBtn not found."
        );

        return;

    }


    console.log(
        "Generate button found successfully."
    );


    // --------------------------------------------------------
    // Connect button
    // --------------------------------------------------------

    generateButton.addEventListener(
        "click",
        generateImage
    );


    // --------------------------------------------------------
    // Load existing images
    // --------------------------------------------------------

    await loadImages();

});


// ============================================================
// GENERATE IMAGE
// ============================================================

async function generateImage() {

    console.log("🔥 GENERATE IMAGE BUTTON CLICKED");


    if (!currentUser || !currentUser.id) {

        alert("Please login first.");

        return;

    }


    const promptElement =
        document.getElementById("prompt");

    const platformElement =
        document.getElementById("platform");

    const styleElement =
        document.getElementById("style");

    const moodElement =
        document.getElementById("mood");

    const button =
        document.getElementById("generateImageBtn");

    const message =
        document.getElementById("imageMsg");


    // --------------------------------------------------------
    // Check HTML elements
    // --------------------------------------------------------

    if (!promptElement) {

        console.error("#prompt not found.");

        return;

    }


    if (!button) {

        console.error(
            "#generateImageBtn not found."
        );

        return;

    }


    const prompt =
        promptElement.value.trim();


    if (!prompt) {

        alert(
            "Please enter an image prompt."
        );

        promptElement.focus();

        return;

    }


    const platform =
        platformElement
            ? platformElement.value
            : "general";


    const style =
        styleElement
            ? styleElement.value
            : "realistic";


    const mood =
        moodElement
            ? moodElement.value
            : "warm and joyful";


    // --------------------------------------------------------
    // Disable button
    // --------------------------------------------------------

    button.disabled = true;

    button.textContent =
        "⏳ Generating Image...";


    if (message) {

        message.textContent =
            "Generating your image...";

        message.className = "";

    }


    try {

        console.log("Sending request to /images");

        console.log({
            user_id: currentUser.id,
            prompt,
            platform,
            style,
            mood
        });


        // ----------------------------------------------------
        // SEND TO BACKEND
        // ----------------------------------------------------

        const response = await fetch(
            "/images",
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    user_id:
                        currentUser.id,

                    prompt:
                        prompt,

                    platform:
                        platform,

                    style:
                        style,

                    mood:
                        mood

                })

            }
        );


        console.log(
            "IMAGE API STATUS:",
            response.status
        );


        const responseText =
            await response.text();


        console.log(
            "IMAGE API RESPONSE:",
            responseText
        );


        let data;

        try {

            data =
                JSON.parse(responseText);

        } catch (error) {

            throw new Error(
                "Server returned an invalid response."
            );

        }


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                data.message ||
                "Image generation failed."
            );

        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        console.log(
            "✅ IMAGE GENERATED SUCCESSFULLY"
        );

        console.log(data);


        promptElement.value = "";


        if (message) {

            message.textContent =
                "Image generated successfully!";

            message.className =
                "success";

        }


        await loadImages();


    } catch (error) {

        console.error(
            "❌ IMAGE GENERATION ERROR:",
            error
        );


        if (message) {

            message.textContent =
                error.message ||
                "Image generation failed.";

            message.className =
                "error";

        }


        alert(
            error.message ||
            "Image generation failed."
        );


    } finally {

        button.disabled = false;

        button.textContent =
            "🎨 Generate Professional Image";

    }

}


// ============================================================
// LOAD IMAGE HISTORY
// ============================================================

async function loadImages() {

    const gallery =
        document.getElementById("imageGrid");


    if (!gallery) {

        console.error(
            "ERROR: #imageGrid not found."
        );

        return;

    }


    if (!currentUser || !currentUser.id) {

        console.error(
            "No current user."
        );

        return;

    }


    try {

        console.log(
            "Loading image history..."
        );


        const response =
            await fetch(
                "/images/" +
                currentUser.id,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        console.log(
            "IMAGE HISTORY STATUS:",
            response.status
        );


        const data =
            await response.json();


        console.log(
            "IMAGE HISTORY:",
            data
        );


        gallery.innerHTML = "";


        if (
            !data.success ||
            !data.images ||
            data.images.length === 0
        ) {

            gallery.innerHTML = `

                <div class="empty-images">

                    No generated images yet.

                </div>

            `;

            return;

        }


        // ----------------------------------------------------
        // Render images
        // ----------------------------------------------------

        data.images.forEach(image => {

            const card =
                document.createElement("div");


            card.className =
                "image-card";


            const imageUrl =
                escapeHtml(
                    image.image_url
                );


            const prompt =
                escapeHtml(
                    image.prompt
                );


            card.innerHTML = `

                <img
                    src="${imageUrl}"
                    alt="AI Generated Image"
                    loading="lazy"
                >

                <div class="image-card-content">

                    <p>
                        ${prompt}
                    </p>

                    <button
                        type="button"
                        class="delete-image-btn"
                    >
                        Delete
                    </button>

                </div>

            `;


            const deleteButton =
                card.querySelector(
                    ".delete-image-btn"
                );


            deleteButton.addEventListener(
                "click",
                () => deleteImage(image.id)
            );


            gallery.appendChild(card);

        });


    } catch (error) {

        console.error(
            "❌ LOAD IMAGES ERROR:",
            error
        );


        gallery.innerHTML = `

            <div class="empty-images">

                Unable to load images.

            </div>

        `;

    }

}


// ============================================================
// DELETE IMAGE
// ============================================================

async function deleteImage(id) {

    if (
        !confirm(
            "Delete this image?"
        )
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                "/images/" + id,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to delete image."
            );

        }


        await loadImages();


    } catch (error) {

        console.error(
            "DELETE IMAGE ERROR:",
            error
        );


        alert(
            error.message ||
            "Failed to delete image."
        );

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await fetch(
            "/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }


    localStorage.removeItem("user");

    localStorage.removeItem(
        "campaignhubRemember"
    );


    window.location.href =
        "/login.html";

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}