const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const auditHelper = require("../../utils/audit.helper");
const { SubscriptionStatus } = require("@prisma/client");
const { validateDowngradeLimits } = require("../../utils/featureFlags");

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

  const subscription = await prisma.subscription.create({
    data: {
      businessId,
      packageId,
      billingCycle,
      setupFeeSnapshot: pkg.setupFee,
      priceMonthlySnapshot: pkg.priceMonthly,
      priceYearlySnapshot: pkg.priceYearly,
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

  await validateDowngradeLimits(businessId, pkg.features);

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

  /* ===========================
     OPTIMISTIC LOCKING UPDATE
  =========================== */

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

/* ===========================
   PACKAGE (SYSTEM LEVEL)
=========================== */

exports.createPackage = async (data, userId) => {
  const exists = await prisma.subscriptionPackage.findUnique({
    where: { code: data.code },
  });

  if (exists) {
    throw new AppError("subscription.package_code_exists", 400);
  }

  const pkg = await prisma.subscriptionPackage.create({
    data,
  });

  await auditHelper.logAudit({
    userId,
    entityType: "SUBSCRIPTION_PACKAGE",
    entityId: pkg.id,
    action: "CREATE",
    metadata: { code: pkg.code },
  });

  return pkg;
};

exports.updatePackage = async (id, data, userId) => {
  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!pkg) {
    throw new AppError("subscription.package_not_found", 404);
  }

  const updated = await prisma.subscriptionPackage.update({
    where: { id },
    data,
  });

  await auditHelper.logAudit({
    userId,
    entityType: "SUBSCRIPTION_PACKAGE",
    entityId: id,
    action: "UPDATE",
  });

  return updated;
};
