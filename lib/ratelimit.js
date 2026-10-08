// A small in-memory limiter: fine for a single-instance demo/portfolio
// deploy. A real multi-instance deployment would use a shared store
// (Redis) instead, since each instance would otherwise count separately.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> array of timestamps

  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const kept = times.filter((t) => t > cutoff);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }, windowMs).unref();

  return function rateLimit(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const cutoff = now - windowMs;
    const times = (hits.get(key) || []).filter((t) => t > cutoff);
    if (times.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: `Too many requests. Try again in a few minutes.` });
    }
    times.push(now);
    hits.set(key, times);
    next();
  };
}

// Separate, coarser cap so a burst of different IPs can't run up your bill.
function createDailyBudget(max) {
  let count = 0;
  let day = new Date().toDateString();
  return function dailyBudget(req, res, next) {
    const today = new Date().toDateString();
    if (today !== day) {
      day = today;
      count = 0;
    }
    if (count >= max) return res.status(429).json({ error: 'Daily analysis limit reached. Please try again tomorrow.' });
    count += 1;
    next();
  };
}

module.exports = { createRateLimiter, createDailyBudget };
