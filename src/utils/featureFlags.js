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
 * Ensure subscription is active
 */
async function requireActiveSubscription(businessId) {
  const subscription = await getActiveSubscription(businessId);

  if (!subscription) {
    throw new AppError("subscription.not_active", 403);
  }

  return subscription;
}

/**
 * BOOLEAN FEATURE CHECK
 */
exports.hasFeature = async (businessId, featureKey) => {
  const subscription = await requireActiveSubscription(businessId);

  const features = subscription.package?.features || {};

  if (!features[featureKey]) {
    throw new AppError("subscription.feature_not_allowed", 403);
  }

  return true;
};

/**
 * GET NUMERIC FEATURE LIMIT
 */
exports.getFeatureLimit = async (businessId, featureKey) => {
  const subscription = await requireActiveSubscription(businessId);
  const features = subscription.package?.features || {};

  return features[featureKey] ?? null;
};

/**
 * VALIDATE NUMERIC LIMIT AGAINST CURRENT USAGE
 */
exports.validateLimit = async (businessId, featureKey, currentUsage) => {
  const limit = await exports.getFeatureLimit(businessId, featureKey);

  if (typeof limit !== "number") {
    return true; // no numeric limit defined
  }

  if (currentUsage > limit) {
    throw new AppError(`subscription.limit_exceeded: ${featureKey}`, 403);
  }

  return true;
};

/**
 * VALIDATE DOWNGRADE SAFETY
 * Ensures new package limits are not violated
 */
exports.validateDowngradeLimits = async (businessId, newFeatures) => {
  const violations = [];

  for (const [key, value] of Object.entries(newFeatures || {})) {
    if (typeof value !== "number") continue;

    let usage = null;

    if (key === "maxUsers") {
      usage = await prisma.user.count({ where: { businessId } });
    }

    if (key === "maxContracts") {
      usage = await prisma.contract.count({ where: { businessId } });
    }

    if (key === "maxCustomers") {
      usage = await prisma.customer.count({ where: { businessId } });
    }

    if (usage !== null && usage > value) {
      violations.push(`${key} limit exceeded`);
    }
  }

  if (violations.length) {
    throw new AppError(
      `subscription.downgrade_limit_violation: ${violations.join(", ")}`,
      400,
    );
  }

  return true;
};
