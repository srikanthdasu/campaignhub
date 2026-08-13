const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const toRegister = document.getElementById("toRegister");
const toLogin = document.getElementById("toLogin");
const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");

toRegister.addEventListener("click", () => {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    toRegister.style.display = "none";
    toLogin.style.display = "block";
});

toLogin.addEventListener("click", () => {
    registerForm.style.display = "none";
    loginForm.style.display = "block";
    toLogin.style.display = "none";
    toRegister.style.display = "block";
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginMsg.textContent = "";
    loginMsg.className = "msg";

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!data.success) {
            loginMsg.textContent = data.message || "Login failed.";
            loginMsg.className = "msg error";
            return;
        }

        window.location.href = "/dashboard";
    } catch (err) {
        loginMsg.textContent = "Could not reach the server.";
        loginMsg.className = "msg error";
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerMsg.textContent = "";
    registerMsg.className = "msg";

    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;

    try {
        const res = await fetch("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (!data.success) {
            registerMsg.textContent = data.message || "Registration failed.";
            registerMsg.className = "msg error";
            return;
        }

        window.location.href = "/dashboard";
    } catch (err) {
        registerMsg.textContent = "Could not reach the server.";
        registerMsg.className = "msg error";
    }
});
