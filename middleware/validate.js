// Returns a middleware that checks the given field names exist (and are non-empty) in req.body.
function requireFields(fields = []) {
    return (req, res, next) => {
        const missing = fields.filter(
            (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ""
        );

        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required field(s): ${missing.join(", ")}`
            });
        }

        next();
    };
}

module.exports = { requireFields };
