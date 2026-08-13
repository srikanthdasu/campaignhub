module.exports = function errorHandler(err, req, res, next) {
    console.error("Unhandled Error:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Something went wrong on the server."
    });
};
