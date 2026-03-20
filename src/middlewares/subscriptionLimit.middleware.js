const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");
const { getLimitHandler } = require("../utils/subscriptionLimitRegistry");

module.exports = (limitKey) => {
  return async (req, res, next) => {
    const businessId = req.user.businessId;

    if (!businessId) {
      return next(new AppError("auth.business_required", 400));
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        businessId,
        status: "ACTIVE",
      },
      select: {
        limitsSnapshot: true,
      },
    });

    if (!subscription) {
      return next(new AppError("subscription.not_found", 404));
    }

    const limits = subscription.limitsSnapshot || {};
    const limitValue = limits[limitKey];

    if (limitValue === null || limitValue === undefined) {
      return next();
    }

    const handler = getLimitHandler(limitKey);

    if (!handler) {
      return next(new AppError("subscription.limit_handler_missing", 500));
    }

    const currentUsage = await handler(req);

    if (currentUsage >= limitValue) {
      return next(new AppError("subscription.limit_exceeded", 403));
    }

    next();
  };
};
