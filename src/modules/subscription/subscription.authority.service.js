const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const { SubscriptionStatus } = require("@prisma/client");

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
  const subscription = await getCurrentSubscription(businessId);

  const features = subscription.featuresSnapshot || {};

  if (!features[featureKey]) {
    throw new AppError("subscription.feature_not_allowed", 403);
  }

  return true;
};

exports.assertLimit = async (businessId, limitKey, currentValue) => {
  const subscription = await getCurrentSubscription(businessId);

  const limits = subscription.limitsSnapshot || {};

  const limit = limits[limitKey];

  if (limit === undefined || limit === null) {
    return true; // unlimited
  }

  if (currentValue >= limit) {
    throw new AppError("subscription.limit_exceeded", 403);
  }

  return true;
};

exports.assertMonthlyLimit = async (businessId, metric) => {
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
