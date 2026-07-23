async function loadAnalytics() {
    loadPlatformChart();
    loadDailyChart();
    loadPromptChart();
}

async function loadPlatformChart() {

    const res = await fetch("/analytics/platforms");
    const data = await res.json();

    new Chart(document.getElementById("platformChart"), {
        type: "pie",
        data: {
            labels: data.map(item => item.platform),
            datasets: [{
                data: data.map(item => Number(item.total))
            }]
        },
        options: {
            responsive: true
        }
    });

}

async function loadDailyChart() {

    const res = await fetch("/analytics/daily");
    const data = await res.json();

    new Chart(document.getElementById("dailyChart"), {
        type: "line",
        data: {
            labels: data.map(item => item.day),
            datasets: [{
                label: "Captions",
                data: data.map(item => Number(item.total)),
                fill: false,
                tension: 0.3
            }]
        },
        options: {
            responsive: true
        }
    });

}

async function loadPromptChart() {

    const res = await fetch("/analytics/prompts");
    const data = await res.json();

    new Chart(document.getElementById("promptChart"), {
        type: "bar",
        data: {
            labels: data.map(item => item.prompt),
            datasets: [{
                label: "Used",
                data: data.map(item => Number(item.total))
            }]
        },
        options: {
            responsive: true,
            indexAxis: "y"
        }
    });

}

loadAnalytics();