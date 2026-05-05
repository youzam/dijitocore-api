const crypto = require("crypto");
const AppError = require("../utils/AppError");
const env = require("../config/env");

module.exports = (req, res, next) => {
  const signature = req.headers["x-payment-signature"];
  const timestamp = req.headers["x-payment-timestamp"];

  if (!signature || !timestamp) {
    return next(new AppError("payment.invalid_signature", 401));
  }
  if (req.headers["content-type"] !== "application/json") {
    return next(new AppError("payment.invalid_content_type", 400));
  }

  const payload = req.rawBody;

  const expected = crypto
    .createHmac("sha256", env.webhooks.payment.secret)
    .update(timestamp + payload)
    .digest("hex");

  if (expected !== signature) {
    return next(new AppError("payment.invalid_signature", 401));
  }

  // Prevent old replay (5 min window)
  const now = Date.now();
  if (Math.abs(now - Number(timestamp)) > 5 * 60 * 1000) {
    return next(new AppError("payment.expired_webhook", 401));
  }

  next();
};
