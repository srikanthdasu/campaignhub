module.exports = function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        // For API calls return JSON; for page loads redirect to login
        if (req.originalUrl.startsWith("/api") || req.headers.accept === "application/json") {
            return res.status(401).json({ success: false, message: "Please log in." });
        }
        return res.redirect("/index.html");
    }
    next();
};
