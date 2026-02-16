const featureFlags = require("../utils/featureFlags");
const AppError = require("../utils/AppError");

/**
 * Usage:
 * subscriptionFeature("allowImport")
 */
module.exports = (featureKey) => {
  // 🔒 Guard invalid feature key definition
  if (!featureKey || typeof featureKey !== "string") {
    throw new Error(
      "subscriptionFeature middleware requires a valid featureKey string",
    );
  }

  return async (req, res, next) => {
    try {
      // 🔒 Defensive guards (non-breaking)
      if (!req.user) {
        return next(new AppError("auth.unauthorized", 401));
      }

      if (!req.user.businessId) {
        return next(new AppError("tenant.missing_business_context", 400));
      }

      // Core SaaS enforcement (unchanged)
      await featureFlags.hasFeature(req.user.businessId, featureKey);

      next();
    } catch (error) {
      next(error);
    }
  };
};
