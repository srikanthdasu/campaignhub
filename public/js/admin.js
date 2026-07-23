loadStats();
loadUsers();
loadCaptions();
loadScheduler();

// ===============================
// Load Statistics
// ===============================
async function loadStats() {

    const res = await fetch("/admin/stats");
    const data = await res.json();

    users.textContent = data.users;
    captions.textContent = data.captions;
    scheduler.textContent = data.scheduler;
    planner.textContent = data.planner;

}

// ===============================
// Load Users
// ===============================
async function loadUsers() {

    const res = await fetch("/admin/users");
    const data = await res.json();

    usersTable.innerHTML = "";

    data.users.forEach(user => {

        usersTable.innerHTML += `
        <tr>

            <td>${user.id}</td>

            <td>${user.name}</td>

            <td>${user.email}</td>

            <td>${new Date(user.created_at).toLocaleDateString()}</td>

            <td>
                <button onclick="deleteUser(${user.id})">
                    Delete
                </button>
            </td>

        </tr>
        `;

    });

}

// ===============================
// Delete User
// ===============================
async function deleteUser(id) {

    const confirmDelete = confirm("Are you sure you want to delete this user?");

    if (!confirmDelete) return;

    const res = await fetch(`/admin/user/${id}`, {
        method: "DELETE"
    });

    const data = await res.json();

    alert(data.message);

    loadUsers();
    loadStats();

}

// ===============================
// Load Captions
// ===============================
async function loadCaptions() {

    const res = await fetch("/admin/captions");
    const data = await res.json();

    captionsTable.innerHTML = "";

    data.captions.forEach(item => {

        captionsTable.innerHTML += `
        <tr>

            <td>${item.prompt}</td>

            <td>${item.platform}</td>

            <td>${new Date(item.created_at).toLocaleDateString()}</td>

        </tr>
        `;

    });

}

// ===============================
// Load Scheduled Posts
// ===============================
async function loadScheduler() {

    const res = await fetch("/admin/scheduled-posts");
    const data = await res.json();

    schedulerTable.innerHTML = "";

    data.posts.forEach(post => {

        schedulerTable.innerHTML += `
        <tr>

            <td>${post.platform}</td>

            <td>${post.caption}</td>

            <td>${new Date(post.schedule_time).toLocaleString()}</td>

            <td>${post.status}</td>

        </tr>
        `;

    });

}