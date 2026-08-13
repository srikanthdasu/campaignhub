// =========================================================
// CampaignHub AI
// Content Planner
// =========================================================

let currentUser = null;


// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("CampaignHub Content Planner initialized.");

    const plannerForm =
        document.getElementById("plannerForm");

    if (plannerForm) {

        plannerForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                await savePlan();

            }
        );

    }

    await loadCurrentUser();

    if (!currentUser) {
        return;
    }

    await Promise.all([
        loadCaptions(),
        loadImages(),
        loadPlans()
    ]);

});


// =========================================================
// CURRENT USER
// =========================================================

async function loadCurrentUser() {

    try {

        const response =
            await fetch("api/auth/me", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });


        if (!response.ok) {

            console.warn(
                "User session not available."
            );

            window.location.href =
                "/login.html";

            return;

        }


        const data =
            await response.json();


        if (!data.success || !data.user) {

            window.location.href =
                "/login.html";

            return;

        }


        currentUser =
            data.user;


        // Keep localStorage synchronized
        localStorage.setItem(
            "user",
            JSON.stringify(currentUser)
        );


        updateUserDisplay();


        console.log(
            "Logged-in user:",
            currentUser
        );


    } catch (error) {

        console.error(
            "Authentication error:",
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

    if (!currentUser) return;


    const nameElement =
        document.getElementById("userName");

    const emailElement =
        document.getElementById("userEmail");

    const avatarElement =
        document.getElementById("userAvatar");


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
// LOAD AI CAPTIONS
// =========================================================

async function loadCaptions() {

    const select =
        document.getElementById("caption");


    if (!select || !currentUser) {
        return;
    }


    select.innerHTML =
        `<option value="">
            Loading captions...
        </option>`;


    try {

        const response =
            await fetch(
                "/captions/history/" +
                currentUser.id,
                {
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load captions."
            );

        }


        const data =
            await response.json();


        /*
         * Support both:
         *
         * [ ... ]
         *
         * and:
         *
         * {
         *   success: true,
         *   captions: [...]
         * }
         */

        const captions =
            Array.isArray(data)
                ? data
                : data.captions || [];


        select.innerHTML =
            `<option value="">
                Select AI Caption
            </option>`;


        if (captions.length === 0) {

            select.innerHTML +=
                `<option value="">
                    No AI captions available
                </option>`;

            return;

        }


        captions.forEach(caption => {

            const option =
                document.createElement("option");


            option.value =
                caption.id;


            const platform =
                caption.platform ||
                "Social";


            const prompt =
                caption.prompt ||
                caption.caption ||
                "AI Caption";


            option.textContent =
                platform +
                " — " +
                truncateText(prompt, 70);


            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Caption loading error:",
            error
        );


        select.innerHTML =
            `<option value="">
                Unable to load captions
            </option>`;

    }

}


// =========================================================
// LOAD AI IMAGES
// =========================================================

async function loadImages() {

    const select =
        document.getElementById("image");


    if (!select || !currentUser) {
        return;
    }


    select.innerHTML =
        `<option value="">
            Loading images...
        </option>`;


    try {

        const response =
            await fetch(
                "/images/" +
                currentUser.id,
                {
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load images."
            );

        }


        const data =
            await response.json();


        const images =
            Array.isArray(data)
                ? data
                : data.images || [];


        select.innerHTML =
            `<option value="">
                Select AI Image
            </option>`;


        if (images.length === 0) {

            select.innerHTML +=
                `<option value="">
                    No AI images available
                </option>`;

            return;

        }


        images.forEach(image => {

            const option =
                document.createElement("option");


            option.value =
                image.id;


            option.textContent =
                truncateText(
                    image.prompt ||
                    "AI Image",
                    70
                );


            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Image loading error:",
            error
        );


        select.innerHTML =
            `<option value="">
                Unable to load images
            </option>`;

    }

}


// =========================================================
// SAVE PLAN
// =========================================================

async function savePlan() {

    if (!currentUser) {

        showMessage(
            "Your login session has expired.",
            "error"
        );

        return;

    }


    const campaign =
        document
            .getElementById("campaign")
            .value
            .trim();


    const platform =
        document
            .getElementById("platform")
            .value;


    const type =
        document
            .getElementById("type")
            .value;


    const caption_id =
        document
            .getElementById("caption")
            .value ||
        null;


    const image_id =
        document
            .getElementById("image")
            .value ||
        null;


    const publish_date =
        document
            .getElementById("publishDate")
            .value ||
        null;


    const status =
        document
            .getElementById("status")
            .value;


    if (!campaign) {

        showMessage(
            "Please enter a campaign name.",
            "error"
        );

        document
            .getElementById("campaign")
            .focus();

        return;

    }


    const button =
        document.getElementById(
            "savePlanBtn"
        );


    button.disabled = true;

    button.innerHTML =
        `<span>⏳</span>
         Creating plan...`;


    clearMessage();


    try {

        const response =
            await fetch(
                "/content-planner/save",
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

                        campaign,

                        platform,

                        type,

                        caption_id,

                        image_id,

                        publish_date,

                        status

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "Unable to save content plan."
            );

        }


        showMessage(
            "Content plan created successfully.",
            "success"
        );


        // Reset form
        document
            .getElementById("campaign")
            .value = "";


        document
            .getElementById("caption")
            .value = "";


        document
            .getElementById("image")
            .value = "";


        document
            .getElementById("publishDate")
            .value = "";


        document
            .getElementById("status")
            .value = "Draft";


        // Refresh plans
        await loadPlans();


    } catch (error) {

        console.error(
            "Save plan error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to save content plan.",
            "error"
        );


    } finally {

        button.disabled = false;

        button.innerHTML =
            `<span>✨</span>
             Create Content Plan`;

    }

}


// =========================================================
// LOAD SAVED PLANS
// =========================================================

async function loadPlans() {

    const container =
        document.getElementById(
            "planList"
        );


    const countElement =
        document.getElementById(
            "planCount"
        );


    if (!container || !currentUser) {
        return;
    }


    container.innerHTML = `
        <div class="empty-state">

            <div class="empty-icon">
                ⏳
            </div>

            <h3>
                Loading plans...
            </h3>

            <p>
                Getting your campaigns.
            </p>

        </div>
    `;


    try {

        const response =
            await fetch(
                "/content-planner/campaign/" +
                currentUser.id,
                {
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load content plans."
            );

        }


        const data =
            await response.json();


        const plans =
            data.plans || [];


        if (countElement) {

            countElement.textContent =
                plans.length;

        }


        if (!data.success ||
            plans.length === 0) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        📅
                    </div>

                    <h3>
                        No content plans yet
                    </h3>

                    <p>
                        Create your first campaign
                        plan using the form.
                    </p>

                </div>
            `;

            return;

        }


        container.innerHTML = "";


        plans.forEach(plan => {

            container.appendChild(
                createPlanElement(plan)
            );

        });


    } catch (error) {

        console.error(
            "Load plans error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    Unable to load plans
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
// CREATE PLAN ELEMENT
// =========================================================

function createPlanElement(plan) {

    const item =
        document.createElement("div");


    item.className =
        "plan-item";


    const status =
        String(
            plan.status ||
            "Draft"
        );


    const statusClass =
        status.toLowerCase() === "ready"
            ? "ready"
            : "";


    const publishDate =
        formatDate(
            plan.publish_date
        );


    item.innerHTML = `

        <div class="plan-top">

            <div>

                <h3 class="plan-title">
                    ${escapeHtml(
                        plan.campaign ||
                        "Untitled Campaign"
                    )}
                </h3>


                <div class="plan-meta">

                    <span class="plan-tag">
                        ${escapeHtml(
                            plan.platform ||
                            "Social"
                        )}
                    </span>

                    <span class="plan-tag">
                        ${escapeHtml(
                            plan.type ||
                            "Post"
                        )}
                    </span>

                </div>

            </div>


            <span class="plan-status ${statusClass}">
                ${escapeHtml(status)}
            </span>

        </div>


        <div class="plan-date">

            📅

            ${
                publishDate ||
                "No publish date"
            }

        </div>


        <div class="plan-actions">

            <button
                type="button"
                class="delete-plan"
                data-plan-id="${plan.id}"
            >
                Delete
            </button>

        </div>

    `;


    const deleteButton =
        item.querySelector(
            ".delete-plan"
        );


    deleteButton.addEventListener(
        "click",
        () => deletePlan(plan.id)
    );


    return item;

}


// =========================================================
// DELETE PLAN
// =========================================================

async function deletePlan(id) {

    if (!id) {
        return;
    }


    const confirmed =
        confirm(
            "Delete this content plan?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                "/content-planner/" +
                id,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "Unable to delete plan."
            );

        }


        await loadPlans();


    } catch (error) {

        console.error(
            "Delete plan error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to delete plan.",
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
            "/apiauth/logout",
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


// =========================================================
// MESSAGE
// =========================================================

function showMessage(
    text,
    type
) {

    const element =
        document.getElementById(
            "plannerMsg"
        );


    if (!element) {
        return;
    }


    element.textContent =
        text;


    element.className =
        "planner-message " +
        type;

}


function clearMessage() {

    const element =
        document.getElementById(
            "plannerMsg"
        );


    if (!element) {
        return;
    }


    element.textContent =
        "";

    element.className =
        "planner-message";

}


// =========================================================
// HELPERS
// =========================================================

function truncateText(
    text,
    length
) {

    text =
        String(text || "");


    if (text.length <= length) {
        return text;
    }


    return text.substring(
        0,
        length
    ) + "...";

}


function formatDate(date) {

    if (!date) {
        return "";
    }


    try {

        const parsed =
            new Date(date);


        if (Number.isNaN(
            parsed.getTime()
        )) {

            return String(date);

        }


        return parsed.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
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