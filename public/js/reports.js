// ===============================
// CampaignHub AI Reports
// ===============================

let downloading = false;

// ===============================
// Build Query String
// ===============================
function buildQuery() {

    const from =
        document.getElementById("fromDate")?.value || "";

    const to =
        document.getElementById("toDate")?.value || "";

    const platform =
        document.getElementById("platform")?.value || "";

    const search =
        document.getElementById("search")?.value.trim() || "";

    const params = new URLSearchParams();

    if (from) params.append("from", from);

    if (to) params.append("to", to);

    if (platform) params.append("platform", platform);

    if (search) params.append("search", search);

    const query = params.toString();

    return query ? `?${query}` : "";

}

// ===============================
// Download
// ===============================
async function download(url) {

    if (downloading) return;

    downloading = true;

    const buttons =
        document.querySelectorAll("button");

    buttons.forEach(btn => btn.disabled = true);

    try {

        const finalUrl =
            url + buildQuery();

        window.open(finalUrl, "_blank");

        setTimeout(() => {

            buttons.forEach(btn => btn.disabled = false);

            downloading = false;

        }, 1200);

    } catch (err) {

        console.error(err);

        buttons.forEach(btn => btn.disabled = false);

        downloading = false;

        alert("Unable to generate report.");

    }

}

// ===============================
// Caption Reports
// ===============================
function downloadCaptionsPDF() {

    download("/reports/captions/pdf");

}

function downloadCaptionsExcel() {

    download("/reports/captions/excel");

}

// ===============================
// Scheduler Reports
// ===============================
function downloadSchedulerPDF() {

    download("/reports/scheduler/pdf");

}

function downloadSchedulerExcel() {

    download("/reports/scheduler/excel");

}