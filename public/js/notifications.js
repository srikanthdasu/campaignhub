const user = JSON.parse(localStorage.getItem("user"));

loadNotifications();

async function loadNotifications(){

    const res = await fetch("/notifications/"+user.id);

    const data = await res.json();

    notifications.innerHTML="";

    data.forEach(n=>{

        notifications.innerHTML +=`

        <div class="card">

            <h3>${n.message}</h3>

            <p>${n.created_at}</p>

            <p>Status : ${n.status}</p>

            <button onclick="markRead(${n.id})">
                Mark Read
            </button>

            <button onclick="deleteNotification(${n.id})">
                Delete
            </button>

        </div>

        `;

    });

}

async function markRead(id){

    await fetch("/notifications/"+id,{
        method:"PUT"
    });

    loadNotifications();

}

async function deleteNotification(id){

    await fetch("/notifications/"+id,{
        method:"DELETE"
    });

    loadNotifications();

}