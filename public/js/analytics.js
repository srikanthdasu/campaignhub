// ===============================
// CampaignHub Analytics
// ===============================

window.onload = () => {

    loadDashboard();

    loadPlatformChart();

    loadDailyChart();

    loadTopPrompts();

};

// ===============================
// Dashboard Summary
// ===============================

async function loadDashboard() {

    try {

        const response = await fetch("/analytics/dashboard");

        const data = await response.json();

        if (!data.success) {

            alert(data.message);
            return;

        }

        document.getElementById("captionCount").innerText =
            data.analytics.captions;

        document.getElementById("imageCount").innerText =
            data.analytics.images;

        document.getElementById("planCount").innerText =
            data.analytics.plans;

        document.getElementById("scheduleCount").innerText =
            data.analytics.scheduled;

    } catch (err) {

        console.error(err);

    }

}

// ===============================
// Platform Usage Chart
// ===============================

async function loadPlatformChart() {

    try {

        const response =
            await fetch("/analytics/by-platform");

        const data =
            await response.json();

        new Chart(

            document.getElementById("platformChart"),

            {

                type: "pie",

                data: {

                    labels:
                        data.map(item => item.platform),

                    datasets: [{

                        data:
                            data.map(item => Number(item.total))

                    }]

                }

            }

        );

    } catch (err) {

        console.error(err);

    }

}

// ===============================
// Daily Caption Chart
// ===============================

async function loadDailyChart() {

    try {

        const response =
            await fetch("/analytics/daily");

        const data =
            await response.json();

        new Chart(

            document.getElementById("dailyChart"),

            {

                type: "bar",

                data: {

                    labels:
                        data.map(item => item.day),

                    datasets: [{

                        label: "Captions",

                        data:
                            data.map(item => Number(item.total))

                    }]

                }

            }

        );

    } catch (err) {

        console.error(err);

    }

}

// ===============================
// Top Prompt Chart
// ===============================

async function loadTopPrompts() {

    try {

        const response =
            await fetch("/analytics/top-prompts");

        const data =
            await response.json();

        new Chart(

            document.getElementById("promptChart"),

            {

                type: "bar",

                data: {

                    labels:
                        data.map(item => item.prompt),

                    datasets: [{

                        label: "Uses",

                        data:
                            data.map(item => Number(item.total))

                    }]

                },

                options: {

                    indexAxis: "y"

                }

            }

        );

    } catch (err) {

        console.error(err);

    }

}

// ===============================
// Logout
// ===============================

function logout() {

    fetch("/auth/logout", {
        method: "POST"
    });

    window.location = "/login.html";

}