const prisma = require("../config/prisma");
const AppError = require("./AppError");
const { SubscriptionStatus } = require("@prisma/client");

/**
 * Fetch active subscription with package features
 */
async function getActiveSubscription(businessId) {
  return prisma.subscription.findFirst({
    where: {
      businessId,
      status: {
        in: [
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.GRACE,
        ],
      },
    },
    include: {
      package: true,
    },
  });
}

/**
 * Check if feature exists
 */
exports.hasFeature = async (businessId, featureKey) => {
  const subscription = await getActiveSubscription(businessId);

  if (!subscription) {
    throw new AppError("subscription.not_active", 403);
  }

  const features = subscription.package?.features || {};

  if (!features[featureKey]) {
    throw new AppError("subscription.feature_not_allowed", 403);
  }

  return true;
};

/**
 * Get feature limit value
 */
exports.getFeatureLimit = async (businessId, featureKey) => {
  const subscription = await getActiveSubscription(businessId);

  if (!subscription) {
    throw new AppError("subscription.not_active", 403);
  }

  const features = subscription.package?.features || {};

  return features[featureKey] ?? null;
};
