const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");

/**
 * Subscription Limit Middleware
 * --------------------------------------------------
 * Usage:
 *   subscriptionLimit("maxUsers")
 *   subscriptionLimit("maxActiveContracts")
 */

module.exports = (limitKey) => {
  return async (req, res, next) => {
    try {
      const businessId = req.user?.businessId;

      if (!businessId) {
        return next(new AppError("auth.business_required", 400));
      }

      // 🔹 Get active subscription
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

      // 🔹 Unlimited or not defined
      if (limitValue === null || limitValue === undefined) {
        return next();
      }

      // 🔥 Limit Handlers (ONLY VALID LIMITS FROM YOUR SYSTEM)
      const limitHandlers = {
        maxUsers: async () => {
          return prisma.user.count({
            where: { businessId },
          });
        },

        maxActiveContracts: async () => {
          return prisma.contract.count({
            where: {
              businessId,
              status: "ACTIVE",
            },
          });
        },

        maxMonthlySms: async () => {
          return prisma.notification.count({
            where: {
              businessId,
              channel: "SMS",
            },
          });
        },

        maxApprovalRequests: async () => {
          return prisma.approvalRequest.count({
            where: {
              businessId,
              status: "PENDING",
            },
          });
        },
      };

      const handler = limitHandlers[limitKey];

      if (!handler) {
        return next(
          new AppError("subscription.limit_handler_not_implemented", 500),
        );
      }

      const currentUsage = await handler();

      if (currentUsage >= limitValue) {
        return next(new AppError("subscription.limit_exceeded", 403));
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
