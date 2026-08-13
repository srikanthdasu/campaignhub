// Simple admin gate. For now, treat user id 1 as the admin account.
// You can later add an `is_admin` boolean column to `users` and check that instead.
module.exports = function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: "Please log in." });
    }
    if (Number(req.session.userId) !== 1) {
        return res.status(403).json({ success: false, message: "Admin access only." });
    }
    next();
};
