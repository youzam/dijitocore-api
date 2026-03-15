const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const auditHelper = require("../../utils/audit.helper");
const { SubscriptionStatus } = require("@prisma/client");
const { validateDowngradeLimits } = require("../../utils/featureFlags");
const registry = require("../../utils/subscriptionFeatureRegistry");

/* ===========================
   INTERNAL
=========================== */

async function findActiveSubscription(businessId) {
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
    include: { package: true },
  });
}

/* ===========================
   BUSINESS OPERATIONS
=========================== */

exports.createSubscription = async ({
  businessId,
  packageId,
  billingCycle,
  userId,
}) => {
  if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
    throw new AppError("subscription.invalid_billing_cycle", 400);
  }

  const existing = await findActiveSubscription(businessId);

  if (existing) {
    throw new AppError("subscription.already_active", 400);
  }

  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.isActive) {
    throw new AppError("subscription.package_not_available", 404);
  }

  if (
    !Number.isInteger(pkg.setupFee) ||
    !Number.isInteger(pkg.priceMonthly) ||
    (pkg.priceYearly !== null &&
      pkg.priceYearly !== undefined &&
      !Number.isInteger(pkg.priceYearly))
  ) {
    throw new AppError("subscription.invalid_package_pricing", 500);
  }

  if (billingCycle === "YEARLY" && !pkg.priceYearly) {
    throw new AppError("subscription.yearly_not_available", 400);
  }

  const startDate = new Date();

  let status = SubscriptionStatus.ACTIVE;
  let endDate = null;

  if (pkg.trialDays > 0) {
    status = SubscriptionStatus.TRIAL;
    endDate = new Date(startDate.getTime() + pkg.trialDays * 86400000);
  }

  const featuresSnapshot = pkg.features?.features || {};
  const limitsSnapshot = pkg.features?.limits || {};

  const subscription = await prisma.subscription.create({
    data: {
      businessId,
      packageId,
      billingCycle,
      setupFeeSnapshot: pkg.setupFee,
      priceMonthlySnapshot: pkg.priceMonthly,
      priceYearlySnapshot: pkg.priceYearly,
      featuresSnapshot,
      limitsSnapshot,
      status,
      startDate,
      endDate,
      version: 1,
      creditBalance: 0,
    },
  });

  await auditHelper.logAudit({
    businessId,
    userId,
    entityType: "SUBSCRIPTION",
    entityId: subscription.id,
    action: "CREATE",
    metadata: {
      packageCode: pkg.code,
      billingCycle,
    },
  });

  return subscription;
};

/* ===========================
   UPGRADE WITH PRORATION
=========================== */

exports.upgradeSubscription = async ({
  businessId,
  subscriptionId,
  packageId,
  billingCycle,
  userId,
}) => {
  if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
    throw new AppError("subscription.invalid_billing_cycle", 400);
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId },
    include: { package: true },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  if (
    ![
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIAL,
      SubscriptionStatus.GRACE,
    ].includes(subscription.status)
  ) {
    throw new AppError("subscription.not_active", 403);
  }

  if (subscription.packageId === packageId) {
    throw new AppError("subscription.same_package", 400);
  }

  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.isActive) {
    throw new AppError("subscription.package_not_available", 404);
  }

  if (
    !Number.isInteger(pkg.setupFee) ||
    !Number.isInteger(pkg.priceMonthly) ||
    (pkg.priceYearly !== null &&
      pkg.priceYearly !== undefined &&
      !Number.isInteger(pkg.priceYearly))
  ) {
    throw new AppError("subscription.invalid_package_pricing", 500);
  }

  if (billingCycle === "YEARLY" && !pkg.priceYearly) {
    throw new AppError("subscription.yearly_not_available", 400);
  }

  /* ===========================
     DOWNGRADE SAFETY CHECK
  =========================== */

  const newLimits = pkg.features?.limits || {};
  await validateDowngradeLimits(businessId, newLimits);

  /* ===========================
     PRORATION ENGINE
  =========================== */

  const now = new Date();
  let credit = 0;

  if (subscription.endDate && subscription.endDate > now) {
    const remainingMs = subscription.endDate - now;
    const remainingDays = Math.floor(remainingMs / 86400000);

    const oldPrice =
      subscription.billingCycle === "YEARLY"
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot;

    const totalDays = subscription.billingCycle === "YEARLY" ? 365 : 30;
    const dailyRate = oldPrice / totalDays;

    credit = Math.floor(dailyRate * remainingDays);
  }

  const featuresSnapshot = pkg.features?.features || {};
  const limitsSnapshot = pkg.features?.limits || {};

  let updated;

  try {
    updated = await prisma.subscription.update({
      where: {
        id: subscriptionId,
        version: subscription.version,
      },
      data: {
        packageId,
        billingCycle,
        setupFeeSnapshot: pkg.setupFee,
        priceMonthlySnapshot: pkg.priceMonthly,
        priceYearlySnapshot: pkg.priceYearly,
        featuresSnapshot,
        limitsSnapshot,
        creditBalance: {
          increment: credit,
        },
        version: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    throw new AppError("subscription.concurrent_update_detected", 409);
  }

  await auditHelper.logAudit({
    businessId,
    userId,
    entityType: "SUBSCRIPTION",
    entityId: subscriptionId,
    action: "UPGRADE",
    metadata: {
      newPackageCode: pkg.code,
      billingCycle,
      creditApplied: credit,
    },
  });

  return updated;
};

exports.cancelSubscription = async (subscriptionId, req) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  if (subscription.status === "CANCELLED") {
    throw new AppError("subscription.already_cancelled", 400);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      metadata: {
        ...(subscription.metadata || {}),
        cancelledBy: req.user.id,
        cancelledAt: new Date(),
      },
    },
  });

  return updated;
};

exports.extendSubscription = async (subscriptionId, data, req) => {
  const { days } = data;

  if (!days || Number(days) <= 0) {
    throw new AppError("subscription.invalid_extension_days", 400);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  const currentExpiry = subscription.expiresAt || new Date();

  const newExpiry = new Date(currentExpiry);
  newExpiry.setDate(newExpiry.getDate() + Number(days));

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      expiresAt: newExpiry,
      status: "ACTIVE",
      metadata: {
        ...(subscription.metadata || {}),
        extendedBy: req.user.id,
        extendedAt: new Date(),
        extensionDays: days,
      },
    },
  });

  return updated;
};

exports.getGraceStatus = async (subscriptionId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  const now = new Date();

  const inGrace =
    subscription.status === "GRACE" &&
    subscription.graceUntil &&
    now <= subscription.graceUntil;

  return {
    subscriptionId,
    status: subscription.status,
    graceUntil: subscription.graceUntil,
    inGrace,
  };
};

exports.extendGracePeriod = async (subscriptionId, data, req) => {
  const { days } = data;

  if (!days || Number(days) <= 0) {
    throw new AppError("subscription.invalid_grace_days", 400);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  const currentGrace = subscription.graceUntil || new Date();

  const newGrace = new Date(currentGrace);
  newGrace.setDate(newGrace.getDate() + Number(days));

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "GRACE",
      graceUntil: newGrace,
      metadata: {
        ...(subscription.metadata || {}),
        graceExtendedBy: req.user.id,
        graceExtendedAt: new Date(),
        graceDays: days,
      },
    },
  });

  return updated;
};
