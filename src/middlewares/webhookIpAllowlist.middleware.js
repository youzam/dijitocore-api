const ipRangeCheck = require("ip-range-check");
const AppError = require("../utils/AppError");
const env = require("../config/env");

module.exports = (req, res, next) => {
  const mode = env.webhooks.payment.ipMode || "PERMISSIVE";

  const rawRanges = env.webhooks.payment.ips;

  // If no IP ranges configured
  if (!rawRanges || rawRanges.trim() === "") {
    if (mode === "STRICT") {
      return next(new AppError("payment.ip_not_configured", 500));
    }

    // PERMISSIVE or DISABLED → continue
    return next();
  }

  const allowedRanges = rawRanges.split(",");

  const requestIp =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  const isAllowed = ipRangeCheck(requestIp, allowedRanges);

  if (!isAllowed) {
    if (mode === "STRICT") {
      return next(new AppError("payment.ip_not_allowed", 403));
    }

    // PERMISSIVE mode → log suspicious IP but allow
    console.warn(`⚠️ Webhook from unlisted IP: ${requestIp}`);
  }

  next();
};
