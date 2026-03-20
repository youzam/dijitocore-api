const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");

module.exports = (featureKey) => {
  return async (req, res, next) => {
    const businessId = req.user.businessId;

    if (!businessId) {
      return next(new AppError("auth.business_required", 400));
    }

    // 🔥 get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        businessId,
        status: "ACTIVE",
      },
      select: {
        featuresSnapshot: true,
      },
    });

    if (!subscription) {
      return next(new AppError("subscription.not_found", 404));
    }

    const features = subscription.featuresSnapshot || {};

    if (!features[featureKey]) {
      return next(new AppError("subscription.feature_not_available", 403));
    }

    next();
  };
};
