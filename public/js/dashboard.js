// ========================================
// CampaignHub AI Dashboard
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    loadUser();
    loadStats();
    loadRecentCaptions();

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

});


// ========================================
// Logged-in User
// ========================================

async function loadUser() {

    try {

        const res = await fetch(
            "/api/auth/me",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) {

            window.location.href =
                "/login.html";

            return;
        }

        const data = await res.json();

        if (!data.success || !data.user) {

            window.location.href =
                "/login.html";

            return;
        }

        const userName =
            document.getElementById("userName");

        if (userName) {

            userName.textContent =
                data.user.name;

        }

    } catch (err) {

        console.error(
            "Load User Error:",
            err
        );

        window.location.href =
            "/login.html";
    }

}


// ========================================
// Dashboard Statistics
// ========================================

async function loadStats() {

    try {

        const res = await fetch(
            "/dashboard/stats",
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await res.json();

        console.log(
            "DASHBOARD STATS:",
            data
        );

        if (!data.success) {
            return;
        }


        const totalCaptions =
            document.getElementById(
                "totalCaptions"
            );

        const scheduledPosts =
            document.getElementById(
                "scheduledPosts"
            );

        const contentPlans =
            document.getElementById(
                "contentPlans"
            );

        const todayCaptions =
            document.getElementById(
                "todayCaptions"
            );


        if (totalCaptions) {

            totalCaptions.textContent =
                data.totalCaptions ?? 0;

        }

        if (scheduledPosts) {

            scheduledPosts.textContent =
                data.scheduledPosts ?? 0;

        }

        if (contentPlans) {

            contentPlans.textContent =
                data.totalPlans ?? 0;

        }

        if (todayCaptions) {

            todayCaptions.textContent =
                data.todayCaptions ?? 0;

        }

    } catch (err) {

        console.error(
            "Stats Error:",
            err
        );

    }

}


// ========================================
// Recent Captions
// ========================================

async function loadRecentCaptions() {

    const container =
        document.getElementById(
            "recentCaptions"
        );

    if (!container) {
        return;
    }

    try {

        const userRes =
            await fetch(
                "/api/auth/me",
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (!userRes.ok) {

            window.location.href =
                "/login.html";

            return;
        }


        const userData =
            await userRes.json();


        if (
            !userData.success ||
            !userData.user
        ) {

            window.location.href =
                "/login.html";

            return;
        }


        const userId =
            userData.user.id;


        const res =
            await fetch(
                `/captions/history/${userId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await res.json();


        if (
            !data.success ||
            !data.captions ||
            data.captions.length === 0
        ) {

            container.innerHTML = `
                <div class="empty">
                    No captions generated yet.
                </div>
            `;

            return;
        }


        const recent =
            data.captions.slice(0, 5);


        let html = "";


        recent.forEach(caption => {

            const platform =
                caption.platform || "Social Media";


            const captionText =
                caption.caption || "";


            const shortText =
                captionText.length > 180
                    ? captionText.substring(0, 180) + "..."
                    : captionText;


            let timeText = "";

            if (caption.created_at) {

                timeText =
                    formatRelativeTime(
                        caption.created_at
                    );

            }


            html += `

                <div class="caption-item">

                    <div class="caption-platform">
                        ${escapeHtml(platform)}
                    </div>

                    <div class="caption-text">
                        ${escapeHtml(shortText)}
                    </div>

                    ${
                        timeText
                            ? `
                                <div class="caption-time">
                                    ${timeText}
                                </div>
                              `
                            : ""
                    }

                </div>

            `;

        });


        container.innerHTML =
            html;


    } catch (err) {

        console.error(
            "Recent Captions Error:",
            err
        );

        container.innerHTML = `
            <div class="empty">
                Unable to load recent captions.
            </div>
        `;

    }

}


// ========================================
// Relative Time
// ========================================

function formatRelativeTime(dateValue) {

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now =
        new Date();

    const seconds =
        Math.floor(
            (now - date) / 1000
        );


    if (seconds < 60) {
        return "Just now";
    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (minutes < 60) {
        return `${minutes}m ago`;
    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (hours < 24) {
        return `${hours}h ago`;
    }


    const days =
        Math.floor(
            hours / 24
        );


    if (days < 7) {
        return `${days}d ago`;
    }


    return date.toLocaleDateString();

}


// ========================================
// HTML Escape
// ========================================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ========================================
// Logout
// ========================================

async function logout() {

    try {

        await fetch(
            "/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (err) {

        console.error(
            "Logout Error:",
            err
        );

    }


    localStorage.removeItem("user");

    localStorage.removeItem(
        "campaignhubRemember"
    );


    window.location.href =
        "/login.html";

}