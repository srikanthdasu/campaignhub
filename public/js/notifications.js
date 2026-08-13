const notifications = document.getElementById("notifications");

window.onload = () => {
    loadNotifications();
};

// ===============================
// Load Notifications
// ===============================
async function loadNotifications() {

    try {

        const res = await fetch("/notifications");
        const data = await res.json();

        notifications.innerHTML = "";

        if (!data.success || data.notifications.length === 0) {

            notifications.innerHTML = `
                <div class="empty">
                    <h2>🔔 No Notifications</h2>
                    <p>You're all caught up!</p>
                </div>
            `;

            return;
        }

        data.notifications.forEach(n => {

            notifications.innerHTML += `

                <div class="notification-card">

                    <div class="notification-header">

                        <h3>🔔 ${n.message}</h3>

                        <span class="${
                            n.is_read ? "badge-read" : "badge-unread"
                        }">

                            ${n.is_read ? "Read" : "Unread"}

                        </span>

                    </div>

                    <p class="time">

                        ${new Date(n.created_at).toLocaleString()}

                    </p>

                    <div class="actions">

                        ${
                            !n.is_read
                            ? `
                            <button
                                class="read-btn"
                                onclick="markRead(${n.id})">

                                ✓ Mark Read

                            </button>
                            `
                            : ""
                        }

                        <button
                            class="delete-btn"
                            onclick="deleteNotification(${n.id})">

                            🗑 Delete

                        </button>

                    </div>

                </div>

            `;

        });

    } catch (err) {

        console.error(err);

        notifications.innerHTML = `
            <div class="empty">
                Failed to load notifications.
            </div>
        `;

    }

}

// ===============================
// Mark Notification Read
// ===============================
async function markRead(id) {

    await fetch("/notifications/read/" + id, {
        method: "PUT"
    });

    loadNotifications();

}

// ===============================
// Delete Notification
// ===============================
async function deleteNotification(id) {

    if (!confirm("Delete this notification?"))
        return;

    await fetch("/notifications/" + id, {
        method: "DELETE"
    });

    loadNotifications();

}