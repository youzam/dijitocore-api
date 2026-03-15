const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

// Import existing subscription service
const subscriptionService = require("../../subscription/subscription.service");

/**
 * =========================
 * FORCE UPGRADE / DOWNGRADE
 * =========================
 */
exports.changeSubscriptionPlan = async (subscriptionId, data, req) => {
  const { packageId } = data;

  if (!packageId) {
    throw new AppError("commerce.package_required", 400);
  }

  // Call existing upgrade logic
  const updated = await subscriptionService.upgradeSubscription(
    subscriptionId,
    { packageId, forced: true },
    req,
  );

  return {
    id: updated.id,
    packageId: updated.packageId,
    status: updated.status,
  };
};

/**
 * =========================
 * CANCEL SUBSCRIPTION
 * =========================
 */
exports.cancelSubscription = async (subscriptionId, req) => {
  const updated = await subscriptionService.cancelSubscription(
    subscriptionId,
    req,
  );

  return {
    id: updated.id,
    status: updated.status,
    cancelledAt: updated.cancelledAt,
  };
};

/**
 * =========================
 * EXTEND SUBSCRIPTION
 * =========================
 */
exports.extendSubscription = async (subscriptionId, data, req) => {
  const updated = await subscriptionService.extendSubscription(
    subscriptionId,
    data,
    req,
  );

  return {
    id: updated.id,
    expiresAt: updated.expiresAt,
    status: updated.status,
  };
};

/**
 * =========================
 * GRACE STATUS
 * =========================
 */
exports.getGraceStatus = async (subscriptionId) => {
  return subscriptionService.getGraceStatus(subscriptionId);
};

/**
 * =========================
 * EXTEND GRACE PERIOD
 * =========================
 */
exports.extendGracePeriod = async (subscriptionId, data, req) => {
  const updated = await subscriptionService.extendGracePeriod(
    subscriptionId,
    data,
    req,
  );

  return {
    id: updated.id,
    graceUntil: updated.graceUntil,
    status: updated.status,
  };
};

/**
 * =========================
 * GET SUBSCRIPTION (ADMIN VIEW)
 * =========================
 */
exports.getSubscriptionDetails = async (subscriptionId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      business: true,
      package: true,
    },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  return {
    id: subscription.id,
    businessId: subscription.businessId,
    businessName: subscription.business?.name || null,

    packageId: subscription.packageId,
    packageName: subscription.package?.name || null,

    status: subscription.status,

    startsAt: subscription.startsAt,
    expiresAt: subscription.expiresAt,
    graceUntil: subscription.graceUntil,

    createdAt: subscription.createdAt,
  };
};
