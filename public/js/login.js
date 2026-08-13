/* =========================================================
   CAMPAIGNHUB AI
   LOGIN JAVASCRIPT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const loginForm =
        document.getElementById("loginForm");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

    const loginButton =
        document.getElementById("loginBtn");

    const togglePassword =
        document.getElementById("togglePassword");

    const googleButton =
        document.getElementById("googleButton");

    const rememberMe =
        document.getElementById("rememberMe");

    const message =
        document.getElementById("msg");

    const forgotPassword =
        document.getElementById("forgotPassword");


    /* =====================================================
       CHECK ELEMENTS
    ===================================================== */

    console.log("CampaignHub login initialized.");

    console.log({
        loginForm,
        emailInput,
        passwordInput,
        loginButton,
        togglePassword,
        googleButton,
        rememberMe,
        message
    });


    /* =====================================================
       REMOVE EMAIL/PASSWORD FROM URL
       
       This protects against the old:
       
       /login.html?email=...&password=...
    ===================================================== */

    const currentParams =
        new URLSearchParams(
            window.location.search
        );

    if (
        currentParams.has("email") ||
        currentParams.has("password")
    ) {

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

    }


    /* =====================================================
       PASSWORD TOGGLE
    ===================================================== */

    if (
        togglePassword &&
        passwordInput
    ) {

        togglePassword.addEventListener(
            "click",
            () => {

                if (
                    passwordInput.type ===
                    "password"
                ) {

                    passwordInput.type =
                        "text";

                    togglePassword.textContent =
                        "🙈";

                    togglePassword.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    passwordInput.type =
                        "password";

                    togglePassword.textContent =
                        "👁";

                    togglePassword.setAttribute(
                        "aria-label",
                        "Show password"
                    );

                }

            }
        );

    }


    /* =====================================================
       GOOGLE LOGIN
    ===================================================== */

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            () => {

                showMessage(
                    "Google sign-in will be connected next.",
                    "error"
                );

            }
        );

    }


    /* =====================================================
       FORGOT PASSWORD
    ===================================================== */

    if (forgotPassword) {

        forgotPassword.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                showMessage(
                    "Password recovery will be connected next.",
                    "error"
                );

            }
        );

    }


    /* =====================================================
       FORM SUBMIT
       
       IMPORTANT:
       We listen to the FORM submit event.
       
       This prevents:
       
       /login.html?email=...&password=...
       
       and sends:
       
       POST /api/auth/login
    ===================================================== */

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            loginUser
        );

    }


    /* =====================================================
       LOGIN FUNCTION
    ===================================================== */

    async function loginUser(event) {


        /* =================================================
           STOP NORMAL HTML FORM SUBMISSION
        ================================================= */

        event.preventDefault();


        clearMessage();


        /* =================================================
           READ VALUES
        ================================================= */

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        /* =================================================
           VALIDATION
        ================================================= */

        if (!email) {

            showMessage(
                "Please enter your email address.",
                "error"
            );

            emailInput.focus();

            return;

        }


        if (!isValidEmail(email)) {

            showMessage(
                "Please enter a valid email address.",
                "error"
            );

            emailInput.focus();

            return;

        }


        if (!password) {

            showMessage(
                "Please enter your password.",
                "error"
            );

            passwordInput.focus();

            return;

        }


        /* =================================================
           LOADING STATE
        ================================================= */

        loginButton.disabled = true;

        loginButton.innerHTML =
            "Signing in...";


        try {


            /* =================================================
               API REQUEST
            ================================================= */

            console.log(
                "Sending login request..."
            );


            const response =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );


            /* =================================================
               READ SERVER RESPONSE
            ================================================= */

            let data;


            try {

                data =
                    await response.json();

            } catch (jsonError) {

                console.error(
                    "Invalid JSON response:",
                    jsonError
                );

                throw new Error(
                    "Server returned an invalid response."
                );

            }


            console.log(
                "Login server response:",
                data
            );


            /* =================================================
               SERVER ERROR
            ================================================= */

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Invalid email or password."
                );

            }


            /* =================================================
               LOGIN SUCCESS
            ================================================= */

            console.log(
                "Login successful:",
                data.user
            );


            showMessage(
                "Login successful. Redirecting...",
                "success"
            );


            loginButton.innerHTML =
                "Signed in ✓";


            /* =================================================
               REMEMBER ME
            ================================================= */

            if (
                rememberMe &&
                rememberMe.checked
            ) {

                localStorage.setItem(
                    "campaignhubRemember",
                    "true"
                );

                localStorage.setItem(
                    "campaignhubEmail",
                    email
                );

            } else {

                localStorage.removeItem(
                    "campaignhubRemember"
                );

                localStorage.removeItem(
                    "campaignhubEmail"
                );

            }


            /* =================================================
               REDIRECT TO DASHBOARD
            ================================================= */

            setTimeout(
                () => {

                    window.location.href =
                        "/dashboard.html";

                },
                700
            );


        } catch (error) {


            /* =================================================
               LOGIN ERROR
            ================================================= */

            console.error(
                "Login error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to sign in.",
                "error"
            );


            /* =================================================
               RESTORE BUTTON
            ================================================= */

            loginButton.disabled = false;

            loginButton.innerHTML =
                `
                <span class="login-button-text">
                    Sign in to CampaignHub
                </span>

                <span class="login-arrow">
                    →
                </span>
                `;

        }

    }


    /* =====================================================
       EMAIL VALIDATION
    ===================================================== */

    function isValidEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);

    }


    /* =====================================================
       SHOW MESSAGE
    ===================================================== */

    function showMessage(
        text,
        type
    ) {

        if (!message) {

            console.log(
                `${type}:`,
                text
            );

            return;

        }


        message.textContent =
            text;


        message.className =
            "message " + type;


        message.style.display =
            "block";

    }


    /* =====================================================
       CLEAR MESSAGE
    ===================================================== */

    function clearMessage() {

        if (!message) {
            return;
        }


        message.textContent =
            "";


        message.className =
            "message";


        message.style.display =
            "none";

    }


    /* =====================================================
       REMEMBERED EMAIL
    ===================================================== */

    const savedRemember =
        localStorage.getItem(
            "campaignhubRemember"
        );


    const savedEmail =
        localStorage.getItem(
            "campaignhubEmail"
        );


    if (
        savedRemember === "true" &&
        savedEmail
    ) {

        emailInput.value =
            savedEmail;

        if (rememberMe) {

            rememberMe.checked =
                true;

        }

    }

});