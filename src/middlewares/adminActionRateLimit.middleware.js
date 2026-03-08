const response = require("../utils/response");

/*
|--------------------------------------------------------------------------
| In-Memory Request Tracker
|--------------------------------------------------------------------------
*/

const requestMap = new Map();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

/*
|--------------------------------------------------------------------------
| Cleanup Old Entries
|--------------------------------------------------------------------------
*/

setInterval(() => {
  const now = Date.now();

  for (const [key, value] of requestMap.entries()) {
    if (now - value.startTime > WINDOW_MS) {
      requestMap.delete(key);
    }
  }
}, WINDOW_MS);

/*
|--------------------------------------------------------------------------
| Admin Action Rate Limit Middleware
|--------------------------------------------------------------------------
*/

async function adminActionRateLimit(req, res, next) {
  try {
    const admin = req.user;

    if (!admin) {
      return next();
    }

    const key = `${admin.id}_${req.method}_${req.baseUrl}`;

    const now = Date.now();

    if (!requestMap.has(key)) {
      requestMap.set(key, {
        count: 1,
        startTime: now,
      });

      return next();
    }

    const data = requestMap.get(key);

    if (now - data.startTime > WINDOW_MS) {
      requestMap.set(key, {
        count: 1,
        startTime: now,
      });

      return next();
    }

    data.count += 1;

    if (data.count > MAX_REQUESTS) {
      return response.error(
        req,
        res,
        null,
        429,
        "security.admin_rate_limit_exceeded",
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = adminActionRateLimit;
