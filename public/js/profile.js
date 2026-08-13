// Get logged-in user
const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
}

// Load profile
// Load profile
async function loadProfile() {

    try {

        const res = await fetch(`/profile/${user.id}`);

        const data = await res.json();

        console.log(data);

        if (data.success) {

            document.getElementById("name").value = data.user.name;
            document.getElementById("email").value = data.user.email;

            // Update Header
            document.getElementById("profileName").innerText = data.user.name;
            document.getElementById("profileName").textContent = data.user.name;
            document.getElementById("profileEmail").textContent = data.user.email;

            const emailElement = document.getElementById("profileEmail");

            if(emailElement){

                emailElement.innerText = data.user.email;

            }

        } else {

            alert(data.message);

        }

    } catch(err){

        console.error(err);

    }

}

// Save profile
document.getElementById("saveBtn").addEventListener("click", async () => {

    const name = document.getElementById("name").value.trim();

    if (!name) {
        alert("Name is required");
        return;
    }

    try {

        const res = await fetch("/profile/update", {

            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                id: user.id,
                name
            })

        });

        const data = await res.json();

        if (data.success) {

            user.name = name;
            localStorage.setItem("user", JSON.stringify(user));

            alert("Profile updated successfully.");

        } else {

            alert(data.message);

        }

    } catch (err) {

        console.error(err);

    }

});

loadProfile();
document.getElementById("changePasswordBtn").addEventListener("click", async () => {

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert("Please fill all password fields.");
        return;
    }

    if (newPassword !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    const res = await fetch("/profile/password", {

        method: "PUT",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            id: user.id,
            currentPassword,
            newPassword

        })

    });

    const data = await res.json();

    alert(data.message);

    if (data.success) {

        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";

    }

});