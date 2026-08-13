/* ============================================================
   CAMPAIGNHUB SCHEDULER
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    loadCaptions();
    loadImages();
    loadSchedules();
});


/* ============================================================
   HELPER
============================================================ */

async function fetchJSON(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            data.error ||
            `Request failed: ${response.status} ${response.statusText}`
        );
    }

    return data;
}


/* ============================================================
   LOAD AI CAPTIONS
============================================================ */

async function loadCaptions() {

    const select = document.getElementById("caption");

    if (!select) return;

    select.innerHTML = `
        <option value="">Loading AI captions...</option>
    `;

    try {

        /*
         * Get logged-in user.
         */
        const userResponse =
            await fetchJSON("/api/auth/me");

        if (
            !userResponse.success ||
            !userResponse.user ||
            !userResponse.user.id
        ) {
            throw new Error("Unable to identify logged-in user.");
        }

        const userId =
            userResponse.user.id;


        /*
         * Your caption route:
         *
         * GET /captions/history/:userId
         */
        const data =
            await fetchJSON(
                `/captions/history/${userId}`
            );


        const captions =
            Array.isArray(data)
                ? data
                : (
                    data.captions ||
                    data.data ||
                    []
                );


        select.innerHTML = `
            <option value="">
                Select AI Caption
            </option>
        `;


        if (!captions.length) {

            select.innerHTML = `
                <option value="">
                    No AI captions available
                </option>
            `;

            return;
        }


        captions.forEach((item, index) => {

            const option =
                document.createElement("option");


            const id =
                item.id ??
                item._id ??
                index;


            const caption =
                item.caption ??
                item.text ??
                item.content ??
                item.generated_caption ??
                "";


            if (!caption) return;


            /*
             * IMPORTANT:
             * Only send caption ID when scheduling.
             */
            option.value = id;


            /*
             * Keep text only for display.
             */
            option.textContent =
                caption.length > 90
                    ? caption.substring(0, 90) + "..."
                    : caption;


            option.dataset.caption =
                caption;


            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Caption loading error:",
            error
        );


        select.innerHTML = `
            <option value="">
                Unable to load AI captions
            </option>
        `;

    }
}


/* ============================================================
   LOAD AI IMAGES
============================================================ */

async function loadImages() {

    const select =
        document.getElementById("image");

    if (!select) return;


    select.innerHTML = `
        <option value="">
            Loading AI images...
        </option>
    `;


    try {

        /*
         * Get logged-in user.
         */
        const userResponse =
            await fetchJSON("/api/auth/me");


        if (
            !userResponse.success ||
            !userResponse.user ||
            !userResponse.user.id
        ) {
            throw new Error(
                "Unable to identify logged-in user."
            );
        }


        const userId =
            userResponse.user.id;


        /*
         * Your image route:
         *
         * GET /images/:userId
         */
        const data =
            await fetchJSON(
                `/images/${userId}`
            );


        const images =
            Array.isArray(data)
                ? data
                : (
                    data.images ||
                    data.data ||
                    []
                );


        select.innerHTML = `
            <option value="">
                Select AI Image
            </option>
        `;


        if (!images.length) {

            select.innerHTML = `
                <option value="">
                    No AI images available
                </option>
            `;

            return;
        }


        images.forEach((item, index) => {

            const option =
                document.createElement("option");


            /*
             * IMPORTANT:
             * Store only image ID.
             */
            option.value =
                item.id ??
                item._id ??
                "";


            /*
             * Display user's prompt.
             */
            option.textContent =
                item.prompt ||
                `AI Image ${index + 1}`;


            /*
             * Keep URL only in browser.
             * DO NOT send this URL to scheduler.
             */
            option.dataset.imageUrl =
                item.image_url ||
                item.imageUrl ||
                item.url ||
                "";


            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Image loading error:",
            error
        );


        select.innerHTML = `
            <option value="">
                Unable to load AI images
            </option>
        `;

    }
}


/* ============================================================
   SAVE SCHEDULE
============================================================ */

async function saveSchedule() {

    const titleElement =
        document.getElementById("title");

    const platformElement =
        document.getElementById("platform");

    const captionElement =
        document.getElementById("caption");

    const imageElement =
        document.getElementById("image");

    const dateElement =
        document.getElementById("date");

    const timeElement =
        document.getElementById("time");


    const title =
        titleElement
            ? titleElement.value.trim()
            : "";


    const platform =
        platformElement
            ? platformElement.value
            : "";


    const captionId =
        captionElement
            ? captionElement.value
            : "";


    const imageId =
        imageElement
            ? imageElement.value
            : "";


    const date =
        dateElement
            ? dateElement.value
            : "";


    const time =
        timeElement
            ? timeElement.value
            : "";


    /* ========================================================
       VALIDATION
    ======================================================== */

    if (!title) {

        alert(
            "Please enter a campaign title."
        );

        if (titleElement) {
            titleElement.focus();
        }

        return;
    }


    if (!platform) {

        alert(
            "Please select a platform."
        );

        return;
    }


    if (!captionId) {

        alert(
            "Please select an AI caption."
        );

        if (captionElement) {
            captionElement.focus();
        }

        return;
    }


    if (!date) {

        alert(
            "Please select a date."
        );

        if (dateElement) {
            dateElement.focus();
        }

        return;
    }


    if (!time) {

        alert(
            "Please select a time."
        );

        if (timeElement) {
            timeElement.focus();
        }

        return;
    }


    /* ========================================================
       BUTTON
    ======================================================== */

    const button =
        document.querySelector(".generate") ||
        document.getElementById("scheduleBtn");


    try {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Scheduling...";

        }


        /* ====================================================
           IMPORTANT BACKEND PAYLOAD
           
           DO NOT SEND:
           - caption text
           - image URL
           - image object
           - title
           - large data
           
           Your scheduler backend expects:
           captionId
           platform
           date
           time
        ==================================================== */

        const payload = {
    title: title,
    captionId: Number(captionId),
    imageId: imageId ? Number(imageId) : null,
    platform: platform,
    date: date,
    time: time
};

        console.log(
            "Sending scheduler payload:",
            payload
        );


        /* ====================================================
           SEND TO BACKEND
        ==================================================== */

        let result;


        try {

            result =
                await fetchJSON(
                    "/api/scheduler",
                    {
                        method: "POST",
                        body: JSON.stringify(payload)
                    }
                );


        } catch (firstError) {

            /*
             * If your server uses /scheduler instead of
             * /api/scheduler, try that route.
             */

            if (
                firstError.message.includes("413")
            ) {
                throw firstError;
            }


            result =
                await fetchJSON(
                    "/scheduler",
                    {
                        method: "POST",
                        body: JSON.stringify(payload)
                    }
                );

        }


        console.log(
            "Schedule result:",
            result
        );


        if (
            result &&
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Could not schedule the post."
            );

        }


        /* ====================================================
           SUCCESS
        ==================================================== */

        alert(
            "Post scheduled successfully!"
        );


        /*
         * Clear form.
         */

        if (titleElement) {
            titleElement.value = "";
        }

        if (captionElement) {
            captionElement.value = "";
        }

        if (imageElement) {
            imageElement.value = "";
        }

        if (dateElement) {
            dateElement.value = "";
        }

        if (timeElement) {
            timeElement.value = "";
        }


        /*
         * Refresh Queue immediately.
         */

        await loadSchedules();


    } catch (error) {

        console.error(
            "Schedule error:",
            error
        );


        alert(
            "Could not schedule the post.\n\n" +
            error.message
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "📅 Schedule Post";

        }

    }

}


/* ============================================================
   LOAD QUEUE
============================================================ */

async function loadSchedules() {

    const list =
        document.getElementById("scheduleList");

    const count =
        document.getElementById("queueCount");


    if (!list) return;


    list.innerHTML = `
        <div class="loading">
            Loading scheduled posts...
        </div>
    `;


    try {

        let data;


        try {

            data =
                await fetchJSON(
                    "/api/scheduler"
                );

        } catch (firstError) {

            data =
                await fetchJSON(
                    "/scheduler"
                );

        }


        const schedules =
            Array.isArray(data)
                ? data
                : (
                    data.schedules ||
                    data.posts ||
                    data.data ||
                    data.items ||
                    []
                );


        if (count) {

            count.textContent =
                schedules.length;

        }


        if (!schedules.length) {

            list.innerHTML = `
                <div class="queue-empty">
                    No scheduled posts yet.
                </div>
            `;

            return;
        }


        /*
         * Sort by schedule time.
         */
        schedules.sort((a, b) => {

            const aTime =
                new Date(
                    a.schedule_time ||
                    a.scheduled_at ||
                    a.scheduledAt ||
                    0
                );


            const bTime =
                new Date(
                    b.schedule_time ||
                    b.scheduled_at ||
                    b.scheduledAt ||
                    0
                );


            return aTime - bTime;

        });


        list.innerHTML = "";


        schedules.forEach(
            schedule => {

                list.appendChild(
                    createQueueItem(schedule)
                );

            }
        );


    } catch (error) {

        console.error(
            "Queue loading error:",
            error
        );


        if (count) {

            count.textContent =
                "0";

        }


        list.innerHTML = `
            <div class="error-message">
                Unable to load scheduled posts.
                <br>
                <small>
                    ${escapeHTML(error.message)}
                </small>
            </div>
        `;

    }

}


/* ============================================================
   CREATE QUEUE ITEM
============================================================ */

function createQueueItem(schedule) {

    const item =
        document.createElement("div");


    item.className =
        "queue-item";


    const title =
        schedule.title ||
        schedule.campaign_title ||
        schedule.campaignTitle ||
        "Scheduled Post";


    const platform =
        schedule.platform ||
        "Instagram";


    const caption =
        schedule.caption ||
        schedule.caption_text ||
        "";


    const status =
        schedule.status ||
        "scheduled";


    const scheduleTime =
        schedule.schedule_time ||
        schedule.scheduled_at ||
        schedule.scheduledAt;


    const formattedTime =
        formatScheduleTime(
            scheduleTime
        );


    const statusLower =
        String(status).toLowerCase();


    let statusClass =
        "status-scheduled";


    if (statusLower === "ready") {

        statusClass =
            "status-ready";

    } else if (statusLower === "draft") {

        statusClass =
            "status-draft";

    }


    item.innerHTML = `

        <h3 class="queue-title">
            ${escapeHTML(title)}
        </h3>


        <div class="queue-meta">

            <span class="queue-tag">
                ${escapeHTML(
                    String(platform).toUpperCase()
                )}
            </span>


            <span class="queue-tag ${statusClass}">
                ${escapeHTML(status)}
            </span>

        </div>


        ${
            caption
                ? `
                    <div class="queue-caption">
                        ${escapeHTML(caption)}
                    </div>
                  `
                : ""
        }


        <div class="queue-time">
            📅 ${escapeHTML(formattedTime)}
        </div>


        ${
            schedule.id
                ? `
                    <button
                        class="queue-delete"
                        type="button"
                        onclick="deleteSchedule(${Number(schedule.id)})"
                    >
                        Delete
                    </button>
                  `
                : ""
        }

    `;


    return item;

}


/* ============================================================
   DELETE SCHEDULE
============================================================ */

async function deleteSchedule(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Delete this scheduled post?"
        );


    if (!confirmed) return;


    try {

        let result;


        try {

            result =
                await fetchJSON(
                    `/api/scheduler/${encodeURIComponent(id)}`,
                    {
                        method: "DELETE"
                    }
                );

        } catch (firstError) {

            result =
                await fetchJSON(
                    `/scheduler/${encodeURIComponent(id)}`,
                    {
                        method: "DELETE"
                    }
                );

        }


        console.log(
            "Delete result:",
            result
        );


        await loadSchedules();


    } catch (error) {

        console.error(
            "Delete schedule error:",
            error
        );


        alert(
            "Could not delete the scheduled post.\n\n" +
            error.message
        );

    }

}


/* ============================================================
   FORMAT DATE/TIME
============================================================ */

function formatScheduleTime(value) {

    if (!value) {

        return "Date/time not set";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
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


/* ============================================================
   LOGOUT
============================================================ */

function logout() {

    window.location.href =
        "/login.html";

}