/* =========================================================
   CAMPAIGNHUB AI
   REGISTER JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTS
       ===================================================== */

    const nameInput =
        document.getElementById("name");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");


    /*
     * Supports both:
     * id="registerButton"
     * class="register-btn"
     */

    const registerButton =
        document.getElementById("registerButton") ||
        document.querySelector(".register-btn");


    /*
     * Supports both:
     * id="togglePassword"
     * class="toggle"
     */

    const togglePassword =
        document.getElementById("togglePassword") ||
        document.querySelector(".toggle");


    /*
     * Supports both:
     * id="googleButton"
     * class="google-btn"
     */

    const googleButton =
        document.getElementById("googleButton") ||
        document.querySelector(".google-btn");


    const message =
        document.getElementById("msg");


    /* =====================================================
       SAFETY CHECK
       ===================================================== */

    if (!nameInput || !emailInput || !passwordInput) {

        console.error(
            "CampaignHub: Registration form fields are missing."
        );

        return;
    }


    /* =====================================================
       PASSWORD TOGGLE
       ===================================================== */

    if (togglePassword) {

        togglePassword.addEventListener("click", () => {

            if (passwordInput.type === "password") {

                passwordInput.type = "text";

                togglePassword.textContent = "🙈";

                togglePassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                passwordInput.type = "password";

                togglePassword.textContent = "👁";

                togglePassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        });

    }


    /* =====================================================
       GOOGLE BUTTON
       ===================================================== */

    if (googleButton) {

        googleButton.addEventListener("click", () => {

            showMessage(
                "Google sign-up will be connected next.",
                "info"
            );

        });

    }


    /* =====================================================
       REGISTER BUTTON
       ===================================================== */

    if (registerButton) {

        registerButton.addEventListener(
            "click",
            registerUser
        );

    } else {

        console.error(
            "CampaignHub: Register button not found."
        );

    }


    /* =====================================================
       REGISTER FUNCTION
       ===================================================== */

    async function registerUser(event) {

        /*
         * Prevent form submission if this button
         * is inside a form.
         */

        if (event) {
            event.preventDefault();
        }


        clearMessage();


        /* =================================================
           GET VALUES
           ================================================= */

        const name =
            nameInput.value.trim();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        /* =================================================
           VALIDATION
           ================================================= */

        if (!name) {

            showMessage(
                "Please enter your full name.",
                "error"
            );

            nameInput.focus();

            return;
        }


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
                "Please enter a password.",
                "error"
            );

            passwordInput.focus();

            return;
        }


        if (password.length < 6) {

            showMessage(
                "Password must be at least 6 characters.",
                "error"
            );

            passwordInput.focus();

            return;
        }


        /* =================================================
           LOADING STATE
           ================================================= */

        if (registerButton) {

            registerButton.disabled = true;

            registerButton.textContent =
                "Creating workspace...";

        }


        /* =================================================
           API REQUEST
           ================================================= */

        try {

            const response = await fetch(
                "/api/auth/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        name: name,
                        email: email,
                        password: password
                    })
                }
            );


            /* =================================================
               SERVER RESPONSE
               ================================================= */

            let data;

            try {

                data = await response.json();

            } catch (jsonError) {

                throw new Error(
                    "Server returned an invalid response."
                );

            }


            /* =================================================
               API ERROR
               ================================================= */

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    "Registration failed."
                );

            }


            /* =================================================
               SUCCESS
               ================================================= */

            showMessage(
                "Account created successfully. Redirecting...",
                "success"
            );


            if (registerButton) {

                registerButton.textContent =
                    "Account Created";

            }


            /* =================================================
               REDIRECT
               ================================================= */

            setTimeout(() => {

                window.location.href =
                    "/dashboard.html";

            }, 900);


        } catch (error) {

            console.error(
                "CampaignHub registration error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to create account.",
                "error"
            );


            /* =================================================
               RESET BUTTON
               ================================================= */

            if (registerButton) {

                registerButton.disabled = false;

                registerButton.textContent =
                    "Create Free Workspace";

            }

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
       MESSAGE
       ===================================================== */

    function showMessage(text, type) {

        if (!message) {

            console.log(
                `[CampaignHub ${type}] ${text}`
            );

            return;
        }


        message.textContent = text;

        message.className =
            "message " + type;

    }


    /* =====================================================
       CLEAR MESSAGE
       ===================================================== */

    function clearMessage() {

        if (!message) {
            return;
        }

        message.textContent = "";

        message.className =
            "message";

    }


    /* =====================================================
       SUPPORT OLD INLINE onclick
       ===================================================== */

    window.registerUser = registerUser;

});