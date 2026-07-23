// ===============================
// CampaignHub AI Dashboard
// ===============================

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    alert("Please login first");
    window.location = "/login.html";
}

document.getElementById("welcome").innerHTML =
`Welcome, <b>${user.name}</b>`;

// Load Dashboard
window.onload = () => {
    loadHistory();
    loadStats();
};

// ===============================
// Dashboard Statistics
// ===============================

async function loadStats() {

    try {

        const response = await fetch("/dashboard/stats");

        const data = await response.json();

        if(data.success){

            document.getElementById("totalCaptions").innerText =
            data.totalCaptions;

            document.getElementById("todayCaptions").innerText =
            data.todayCaptions;

            document.getElementById("totalUsers").innerText =
            data.totalUsers;

        }

    } catch(err){

        console.log(err);

    }

}

// ===============================
// Generate Caption
// ===============================

async function generateCaption(){

    const prompt =
    document.getElementById("prompt").value.trim();

    const platform =
    document.getElementById("platform").value;

    if(prompt===""){

        alert("Please enter a prompt");

        return;

    }

    document.getElementById("result").innerHTML =
    "Generating AI Caption...";

    try{

        const response =
        await fetch("/api/generate-caption",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                user_id:user.id,
                prompt,
                platform

            })

        });

        const data = await response.json();

        if(data.success){

            document.getElementById("result").innerHTML =
            data.caption;

            document.getElementById("prompt").value="";

            loadHistory();

            loadStats();

        }else{

            document.getElementById("result").innerHTML =
            data.error;

        }

    }catch(err){

        console.log(err);

        alert("Server Error");

    }

}

// ===============================
// Load Caption History
// ===============================

let allCaptions = [];

async function loadHistory() {

    try {

        const response = await fetch("/captions");
        const data = await response.json();

        allCaptions = data.captions || [];

        renderHistory(allCaptions);

    } catch (err) {

        console.error(err);

        document.getElementById("history").innerHTML =
        "<p class='empty'>Unable to load captions.</p>";

    }

}

// ===============================
// Render History
// ===============================

function renderHistory(captions){

    const history = document.getElementById("history");

    if(captions.length === 0){

        history.innerHTML = `
            <div class="empty">
                No captions found.
            </div>
        `;

        return;
    }

    let html = "";

    captions.forEach(c => {

        html += `
        <div class="card">

            <div class="platform">${c.platform}</div>

            <p><strong>Prompt:</strong> ${c.prompt}</p>

         <p class="caption-text">
${c.caption
    .replace(/\n/g, "<br>")
    .replace(/Short Caption:/g, "<strong>Short Caption:</strong><br>")
    .replace(/Long Caption:/g, "<strong>Long Caption:</strong><br>")
    .replace(/Hashtags:/g, "<strong>Hashtags:</strong><br>")
    .replace(/Call To Action:/g, "<strong>Call To Action:</strong><br>")
    .replace(/Emoji Version:/g, "<strong>Emoji Version:</strong><br>")
}
</p>

            <div class="actions">

                <button
                    class="copyBtn"
                    onclick="copyCaption(\`${c.caption.replace(/`/g,"\\`")}\`)">

                    📋 Copy

                </button>

                <button
                    class="shareBtn"
                    onclick="shareWhatsApp(\`${c.caption.replace(/`/g,"\\`")}\`)">

                    💬 WhatsApp

                </button>

                <button
                    class="deleteBtn"
                    onclick="deleteCaption(${c.id})">

                    🗑 Delete

                </button>

            </div>

        </div>
        `;

    });

    history.innerHTML = html;

}
// ===============================
// Search
// ===============================

document.getElementById("search").addEventListener("keyup", function(){

    const value = this.value.toLowerCase();

    const filtered = allCaptions.filter(c =>

        c.prompt.toLowerCase().includes(value) ||
        c.caption.toLowerCase().includes(value) ||
        c.platform.toLowerCase().includes(value)

    );

    renderHistory(filtered);

});

// ===============================
// Copy
// ===============================

function copyCaption(text){

    navigator.clipboard.writeText(text);

    alert("Caption copied successfully!");

}

// ===============================
// WhatsApp Share
// ===============================

function shareWhatsApp(text){

    const url =
    "https://wa.me/?text=" + encodeURIComponent(text);

    window.open(url,"_blank");

}

// ===============================
// Delete
// ===============================

async function deleteCaption(id){

    if(!confirm("Delete this caption?")) return;

    try{

        const response =
        await fetch("/captions/"+id,{

            method:"DELETE"

        });

        const data = await response.json();

        if(data.success){

            loadHistory();

            loadStats();

            alert("Caption deleted.");

        }else{

            alert(data.error);

        }

    }catch(err){

        console.error(err);

    }

}

// ===============================
// Logout
// ===============================

function logout(){

    localStorage.removeItem("user");

    window.location="/login.html";

}