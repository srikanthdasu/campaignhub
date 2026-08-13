// Lightweight in-memory rate limiter — no extra npm package required.
// Limits each IP to `max` requests per `windowMs` milliseconds.
const hits = new Map();

function rateLimiter({ windowMs = 60 * 1000, max = 60 } = {}) {
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();

        let entry = hits.get(key);
        if (!entry || now - entry.start > windowMs) {
            entry = { start: now, count: 0 };
        }

        entry.count += 1;
        hits.set(key, entry);

        if (entry.count > max) {
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please slow down and try again shortly."
            });
        }

        next();
    };
}

module.exports = rateLimiter;
