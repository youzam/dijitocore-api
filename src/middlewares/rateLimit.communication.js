const limits = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

const rateLimitCommunication = (req, res, next) => {
  const key = req.user.id; // per admin
  const now = Date.now();

  if (!limits.has(key)) {
    limits.set(key, []);
  }

  // remove old timestamps
  const timestamps = limits.get(key).filter((ts) => now - ts < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: req.t("communication.rate_limit_exceeded"),
    });
  }

  timestamps.push(now);
  limits.set(key, timestamps);

  next();
};

module.exports = rateLimitCommunication;
