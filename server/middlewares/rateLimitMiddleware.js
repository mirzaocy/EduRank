/**
 * Small, dependency-free fixed-window limiter for public HTTP endpoints.
 * It is intentionally scoped per process; use an edge/WAF or Redis-backed
 * limiter as well when the service is deployed across multiple instances.
 */
function createRateLimiter({ windowMs, max, keyGenerator = (req) => req.ip } = {}) {
    if (!Number.isInteger(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max <= 0) {
        throw new TypeError('windowMs and max must be positive integers.');
    }

    const hits = new Map();
    let requestsSinceCleanup = 0;

    return (req, res, next) => {
        const now = Date.now();
        requestsSinceCleanup += 1;
        if (requestsSinceCleanup >= 1_000) {
            requestsSinceCleanup = 0;
            for (const [existingKey, existingRecord] of hits) {
                if (existingRecord.resetAt <= now) hits.delete(existingKey);
            }
        }
        const key = String(keyGenerator(req) || 'unknown');
        const record = hits.get(key);
        const current = !record || now >= record.resetAt
            ? { count: 0, resetAt: now + windowMs }
            : record;

        current.count += 1;
        hits.set(key, current);
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - current.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

        if (current.count > max) {
            res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        next();
    };
}

module.exports = { createRateLimiter };
