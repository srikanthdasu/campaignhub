// =========================================================
// CampaignHub AI
// AI Captions
// =========================================================

let currentUser = null;


// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "CampaignHub AI Captions initialized."
        );


        const generateButton =
            document.getElementById(
                "generateBtn"
            );


        const logoutButton =
            document.getElementById(
                "logoutBtn"
            );


        const copyButton =
            document.getElementById(
                "copyBtn"
            );


        if (generateButton) {

            generateButton.addEventListener(
                "click",
                generateCaption
            );

        }


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            );

        }


        if (copyButton) {

            copyButton.addEventListener(
                "click",
                copyCaption
            );

        }


        await loadUser();

    }
);


// =========================================================
// LOAD USER
// =========================================================

async function loadUser() {

    try {

        const response =
            await fetch(
                "/api/auth/me",
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        console.log(
            "Captions auth status:",
            response.status
        );


        if (!response.ok) {

            window.location.href =
                "/login.html";

            return;

        }


        const data =
            await response.json();


        console.log(
            "Captions current user:",
            data
        );


        if (
            !data.success ||
            !data.user
        ) {

            window.location.href =
                "/login.html";

            return;

        }


        currentUser =
            data.user;


        localStorage.setItem(
            "user",
            JSON.stringify(currentUser)
        );


        updateUserDisplay();


        await loadHistory();


    } catch (error) {

        console.error(
            "Load user error:",
            error
        );


        window.location.href =
            "/login.html";

    }

}


// =========================================================
// USER DISPLAY
// =========================================================

function updateUserDisplay() {

    if (!currentUser) {
        return;
    }


    const nameElement =
        document.getElementById(
            "userName"
        );


    const emailElement =
        document.getElementById(
            "userEmail"
        );


    const avatarElement =
        document.getElementById(
            "userAvatar"
        );


    if (nameElement) {

        nameElement.textContent =
            currentUser.name ||
            "User";

    }


    if (emailElement) {

        emailElement.textContent =
            currentUser.email ||
            "";

    }


    if (avatarElement) {

        const name =
            currentUser.name ||
            currentUser.email ||
            "U";


        avatarElement.textContent =
            name
                .charAt(0)
                .toUpperCase();

    }

}


// =========================================================
// GENERATE CAPTION
// =========================================================

async function generateCaption() {

    if (!currentUser) {

        showMessage(
            "Your login session has expired.",
            "error"
        );

        return;

    }


    const promptInput =
        document.getElementById(
            "prompt"
        );


    const platformInput =
        document.getElementById(
            "platform"
        );


    const resultBox =
        document.getElementById(
            "resultBox"
        );


    const generateButton =
        document.getElementById(
            "generateBtn"
        );


    const copyButton =
        document.getElementById(
            "copyBtn"
        );


    const prompt =
        promptInput.value.trim();


    const platform =
        platformInput.value;


    if (!prompt) {

        showMessage(
            "Please enter a campaign prompt.",
            "error"
        );

        promptInput.focus();

        return;

    }


    clearMessage();


    generateButton.disabled = true;

    generateButton.innerHTML =
        `<span>⏳</span>
         Generating...`;


    resultBox.className =
        "result-box";


    resultBox.textContent =
        "Creating your caption...";


    copyButton.disabled = true;


    try {

        const response =
            await fetch(
                "/api/generate-caption",
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({

                        user_id:
                            currentUser.id,

                        prompt,

                        platform

                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Caption generation response:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                data.message ||
                "Failed to generate caption."
            );

        }


        resultBox.textContent =
            data.caption;


        resultBox.className =
            "result-box filled";


        copyButton.disabled = false;


        showMessage(
            "Caption generated successfully.",
            "success"
        );


        await loadHistory();


    } catch (error) {

        console.error(
            "Caption generation error:",
            error
        );


        resultBox.textContent =
            error.message ||
            "Could not generate caption.";


        resultBox.className =
            "result-box";


        showMessage(
            error.message ||
            "Unable to generate caption.",
            "error"
        );


    } finally {

        generateButton.disabled =
            false;


        generateButton.innerHTML =
            `<span>✨</span>
             Generate Caption`;

    }

}


// =========================================================
// LOAD HISTORY
// =========================================================

async function loadHistory() {

    if (!currentUser) {
        return;
    }


    const list =
        document.getElementById(
            "historyList"
        );


    const count =
        document.getElementById(
            "historyCount"
        );


    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="empty-state">

            <div class="empty-icon">
                ⏳
            </div>

            <h3>
                Loading captions...
            </h3>

            <p>
                Getting your caption history.
            </p>

        </div>
    `;


    try {

        const response =
            await fetch(
                `/captions/history/${currentUser.id}`,
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load caption history."
            );

        }


        const data =
            await response.json();


        /*
         * Your existing API may return:
         *
         * [
         *   {...},
         *   {...}
         * ]
         *
         * or:
         *
         * {
         *   success: true,
         *   captions: [...]
         * }
         */

        const rows =
            Array.isArray(data)
                ? data
                : data.captions || [];


        if (count) {

            count.textContent =
                rows.length;

        }


        if (
            !Array.isArray(rows) ||
            rows.length === 0
        ) {

            list.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ✨
                    </div>

                    <h3>
                        No captions yet
                    </h3>

                    <p>
                        Generate your first caption
                        using the generator.
                    </p>

                </div>
            `;

            return;

        }


        list.innerHTML = "";


        rows.forEach(row => {

            list.appendChild(
                createHistoryElement(row)
            );

        });


    } catch (error) {

        console.error(
            "History loading error:",
            error
        );


        list.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    Could not load history
                </h3>

                <p>
                    Please refresh the page
                    and try again.
                </p>

            </div>
        `;

    }

}


// =========================================================
// HISTORY ITEM
// =========================================================

function createHistoryElement(row) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "history-item";


    const platform =
        row.platform ||
        "Social";


    const date =
        formatDate(
            row.created_at
        );


    const caption =
        row.caption ||
        "";


    item.innerHTML = `

        <div class="history-meta">

            <span class="history-platform">
                ${escapeHtml(platform)}
            </span>

            <span class="history-date">
                ${escapeHtml(date)}
            </span>

        </div>


        <div class="history-text">
            ${escapeHtml(caption)}
        </div>


        <div class="history-actions">

            <button
                type="button"
                class="delete-caption"
            >
                Delete
            </button>

        </div>

    `;


    const deleteButton =
        item.querySelector(
            ".delete-caption"
        );


    deleteButton.addEventListener(
        "click",
        () => deleteCaption(row.id)
    );


    return item;

}


// =========================================================
// DELETE CAPTION
// =========================================================

async function deleteCaption(id) {

    if (!id) {
        return;
    }


    if (
        !confirm(
            "Delete this caption?"
        )
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                `/captions/${id}`,
                {
                    method: "DELETE",

                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "Could not delete caption."
            );

        }


        await loadHistory();


    } catch (error) {

        console.error(
            "Delete caption error:",
            error
        );


        showMessage(
            error.message ||
            "Could not delete caption.",
            "error"
        );

    }

}


// =========================================================
// COPY CAPTION
// =========================================================

async function copyCaption() {

    const resultBox =
        document.getElementById(
            "resultBox"
        );


    const text =
        resultBox.textContent.trim();


    if (
        !text ||
        text ===
            "Your generated caption will appear here."
    ) {

        return;

    }


    try {

        await navigator.clipboard.writeText(
            text
        );


        const copyButton =
            document.getElementById(
                "copyBtn"
            );


        copyButton.textContent =
            "Copied!";


        setTimeout(() => {

            copyButton.textContent =
                "Copy";

        }, 1500);


    } catch (error) {

        console.error(
            "Copy error:",
            error
        );

        showMessage(
            "Could not copy caption.",
            "error"
        );

    }

}


// =========================================================
// LOGOUT
// =========================================================

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


    localStorage.removeItem(
        "user"
    );


    localStorage.removeItem(
        "campaignhubRemember"
    );


    window.location.href =
        "/login.html";

}


// =========================================================
// MESSAGE
// =========================================================

function showMessage(
    text,
    type
) {

    const element =
        document.getElementById(
            "captionMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        text;


    element.className =
        "caption-message " +
        type;

}


function clearMessage() {

    const element =
        document.getElementById(
            "captionMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        "";


    element.className =
        "caption-message";

}


// =========================================================
// HELPERS
// =========================================================

function formatDate(date) {

    if (!date) {
        return "";
    }


    try {

        const parsed =
            new Date(date);


        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {

            return String(date);

        }


        return parsed.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch {

        return String(date);

    }

}


function escapeHtml(value) {

    return String(value || "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}