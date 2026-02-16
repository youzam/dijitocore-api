const AppError = require("../utils/AppError");
const subscriptionAuthority = require("../modules/subscription/subscription.authority.service");

/**
 * Usage:
 * subscriptionFeature("allowImport")
 */
module.exports = (featureKey) => {
  if (!featureKey || typeof featureKey !== "string") {
    throw new Error(
      "subscriptionFeature middleware requires a valid featureKey string",
    );
  }

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError("auth.unauthorized", 401));
      }

      if (!req.user.businessId) {
        return next(new AppError("tenant.missing_business_context", 400));
      }

      const businessId = req.user.businessId;

      // 🔒 Enforce ACTIVE / TRIAL / GRACE
      await subscriptionAuthority.assertActiveSubscription(businessId);

      // 🔒 Enforce feature access
      await subscriptionAuthority.assertFeature(businessId, featureKey);

      next();
    } catch (error) {
      next(error);
    }
  };
};
