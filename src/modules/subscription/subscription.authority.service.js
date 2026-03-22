const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const { SubscriptionStatus } = require("@prisma/client");
const registry = require("../../utils/subscriptionFeatureRegistry");
const limitResolver = require("../../utils/subscriptionLimitResolver");

/* ===========================
   INTERNAL
=========================== */

async function getCurrentSubscription(businessId) {
  const subscription = await prisma.subscription.findFirst({
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
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new AppError("subscription.not_active", 403);
  }

  return subscription;
}

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/* ===========================
   PUBLIC API
=========================== */

exports.assertActiveSubscription = async (businessId) => {
  const subscription = await prisma.subscription.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  if (
    ![
      SubscriptionStatus.TRIAL,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.GRACE,
    ].includes(subscription.status)
  ) {
    throw new AppError("subscription.not_active", 403);
  }

  return subscription;
};

exports.assertFeature = async (businessId, featureKey) => {
  if (!registry.isValidFeatureKey(featureKey)) {
    throw new AppError(`Invalid feature configuration: ${featureKey}`, 500);
  }

  const subscription = await getCurrentSubscription(businessId);

  const features = subscription.featuresSnapshot || {};

  if (!features[featureKey]) {
    throw new AppError("subscription.feature_not_allowed", 403);
  }

  return true;
};

// =====================================================
// 🔥 ASSERT LIMIT (UNIFIED VERSION)
// =====================================================
exports.assertLimit = async (businessId, limitKey, options = {}) => {
  const { currentValue } = options;

  // 🔹 validate limit key
  if (!registry.isValidLimitKey(limitKey)) {
    throw new AppError(`Invalid limit configuration: ${limitKey}`, 500);
  }

  // 🔹 get subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      businessId,
      status: {
        in: ["ACTIVE", "TRIAL", "GRACE"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  const limits = subscription.limitsSnapshot || {};
  const limitValue = limits[limitKey];

  // 🔹 unlimited
  if (limitValue === null || limitValue === undefined) {
    return true;
  }

  let usage;

  // =====================================================
  // 🔹 MODE 1: DIRECT VALUE (preferred for performance)
  // =====================================================
  if (currentValue !== undefined) {
    usage = currentValue;
  }

  // =====================================================
  // 🔹 MODE 2: RESOLVER (fallback)
  // =====================================================
  else {
    const resolver = limitResolver.getResolver(limitKey);

    if (!resolver) {
      throw new AppError("subscription.limit_not_configured", 500);
    }

    usage = await resolver(businessId);
  }

  if (Number(usage) >= Number(limitValue)) {
    throw new AppError("subscription.limit_exceeded", 403);
  }

  return true;
};

exports.assertMonthlyLimit = async (businessId, metric) => {
  if (!registry.isValidLimitKey(metric)) {
    throw new AppError(`Invalid monthly limit configuration: ${metric}`, 500);
  }

  const subscription = await getCurrentSubscription(businessId);

  const limits = subscription.limitsSnapshot || {};
  const limit = limits[metric];

  if (limit === undefined || limit === null) {
    return true;
  }

  const period = getCurrentPeriod();

  const usage = await prisma.subscriptionUsage.findUnique({
    where: {
      businessId_metric_period: {
        businessId,
        metric,
        period,
      },
    },
  });

  const used = usage ? usage.value : 0;

  if (used >= limit) {
    throw new AppError("subscription.monthly_limit_exceeded", 403);
  }

  return true;
};

exports.trackUsage = async (businessId, metric, amount = 1) => {
  const period = getCurrentPeriod();

  await prisma.subscriptionUsage.upsert({
    where: {
      businessId_metric_period: {
        businessId,
        metric,
        period,
      },
    },
    update: {
      value: {
        increment: amount,
      },
    },
    create: {
      businessId,
      metric,
      period,
      value: amount,
    },
  });
};

// 🔥 ASSERT LIMIT
exports.assertLimit = async (businessId, limitKey) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      businessId,
      status: { in: ["ACTIVE", "TRIAL", "GRACE"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  const limits = subscription.limitsSnapshot || {};
  const limitValue = limits[limitKey];

  // unlimited
  if (limitValue === null || limitValue === undefined) {
    return true;
  }

  const resolver = limitResolver.getResolver(limitKey);

  if (!resolver) {
    throw new AppError("subscription.limit_not_configured", 500);
  }

  const currentCount = await resolver(businessId);

  if (Number(currentCount) >= Number(limitValue)) {
    throw new AppError("subscription.limit_exceeded", 403);
  }

  return true;
};
