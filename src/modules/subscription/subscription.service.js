const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const auditHelper = require('../../utils/audit.helper');
const { SubscriptionStatus } = require('@prisma/client');
const { validateDowngradeLimits } = require('../../utils/featureFlags');
const couponService = require('./subscription.coupon.service');
const subscriptionService = require('./subscription.payment.service');

/* ===========================
   INTERNAL
=========================== */

async function findActiveSubscription(businessId) {
  return prisma.subscription.findFirst({
    where: {
      businessId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE],
      },
    },
    include: { package: true },
  });
}

async function findPendingSubscription(businessId) {
  return prisma.subscription.findFirst({
    where: {
      businessId,
      status: SubscriptionStatus.PENDING,
    },
  });
}

/* ===========================
   BUSINESS OPERATIONS
=========================== */
exports.calculatePrice = async ({ businessId, subscriptionId }) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId },
  });

  if (!subscription) {
    throw new AppError('subscription.not_found', 404);
  }

  const isInitial = !subscription.setupFeePaid;

  const subscriptionAmount =
    subscription.billingCycle === 'YEARLY'
      ? subscription.priceYearlySnapshot
      : subscription.priceMonthlySnapshot;

  const setupFeeAmount = isInitial ? subscription.setupFeeSnapshot : 0;

  const baseAmount = subscriptionAmount + setupFeeAmount;

  if (!Number.isInteger(baseAmount) || baseAmount < 0) {
    throw new AppError('payment.invalid_amount', 500);
  }

  // 🔹 ADJUSTMENTS
  let adjustmentTotal = 0;

  const adjustments = await prisma.financialAdjustment.findMany({
    where: {
      businessId: subscription.businessId,
      isApplied: false,
    },
  });

  for (const adj of adjustments) {
    if (adj.type === 'CREDIT') {
      adjustmentTotal -= Number(adj.amount);
    } else if (adj.type === 'DEBIT') {
      adjustmentTotal += Number(adj.amount);
    }
  }

  let calculatedAmount = baseAmount + adjustmentTotal;

  // 🔹 CREDIT BALANCE
  let creditApplied = 0;

  if (subscription.creditBalance > 0) {
    creditApplied = Math.min(subscription.creditBalance, calculatedAmount);

    calculatedAmount = Math.max(
      0,
      calculatedAmount - subscription.creditBalance,
    );
  }

  return {
    baseAmount,
    adjustments: adjustmentTotal,
    creditApplied,
    finalAmount: calculatedAmount,
  };
};

exports.applyCouponToSubscription = async ({
  businessId,
  subscriptionId,
  couponCode,
}) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId },
  });

  if (!subscription) {
    throw new AppError('subscription.not_found', 404);
  }

  const isInitial = !subscription.setupFeePaid;

  // 🔹 BASE AMOUNT
  let baseAmount;

  if (isInitial) {
    baseAmount =
      subscription.setupFeeSnapshot +
      (subscription.billingCycle === 'YEARLY'
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot);
  } else {
    baseAmount =
      subscription.billingCycle === 'YEARLY'
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot;
  }

  if (!Number.isInteger(baseAmount) || baseAmount < 0) {
    throw new AppError('payment.invalid_amount', 500);
  }

  // 🔹 ADJUSTMENTS
  let adjustmentTotal = 0;

  const adjustments = await prisma.financialAdjustment.findMany({
    where: {
      businessId: subscription.businessId,
      isApplied: false,
    },
  });

  for (const adj of adjustments) {
    if (adj.type === 'CREDIT') {
      adjustmentTotal -= Number(adj.amount);
    } else if (adj.type === 'DEBIT') {
      adjustmentTotal += Number(adj.amount);
    }
  }

  let calculatedAmount = baseAmount + adjustmentTotal;

  // 🔹 CREDIT BALANCE
  let creditApplied = 0;

  if (subscription.creditBalance > 0) {
    creditApplied = Math.min(subscription.creditBalance, calculatedAmount);

    calculatedAmount = Math.max(
      0,
      calculatedAmount - subscription.creditBalance,
    );
  }

  // 🔹 APPLY COUPON (PURE SERVICE)
  const { coupon, discount } = await couponService.applyCouponForCheckout({
    code: couponCode,
    businessId,
    amount: calculatedAmount,
  });

  const finalAmount = Math.max(0, calculatedAmount - discount);

  return {
    baseAmount,
    adjustments: adjustmentTotal,
    creditApplied,
    couponDiscount: discount,
    finalAmount,
    couponId: coupon.id,
    couponCode: coupon.code,
  };
};

exports.createSubscription = async (body, userId) => {
  const {
    businessId,
    packageId,
    billingCycle,
    paymentMethod,
    gateway,
    phone,
    couponId,
  } = body;

  if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
    throw new AppError('subscription.invalid_billing_cycle', 400);
  }

  const existing = await findActiveSubscription(businessId);

  if (existing) {
    throw new AppError('subscription.already_active', 400);
  }

  const pendingSubscription = await findPendingSubscription(businessId);

  const pkg = await prisma.subscriptionPackage.findUnique({
    where: {
      id: packageId,
    },
  });

  if (!pkg || !pkg.isActive) {
    throw new AppError('subscription.package_not_available', 404);
  }

  if (
    !Number.isInteger(pkg.setupFee) ||
    !Number.isInteger(pkg.priceMonthly) ||
    (pkg.priceYearly !== null &&
      pkg.priceYearly !== undefined &&
      !Number.isInteger(pkg.priceYearly))
  ) {
    throw new AppError('subscription.invalid_package_pricing', 500);
  }

  if (billingCycle === 'YEARLY' && !pkg.priceYearly) {
    throw new AppError('subscription.yearly_not_available', 400);
  }

  const startDate = new Date();

  let status = SubscriptionStatus.PENDING;

  let endDate = null;

  const featuresSnapshot = pkg.features || {};

  const limitsSnapshot = pkg.limits || {};

  let subscription;

  if (pendingSubscription) {
    subscription = await prisma.subscription.update({
      where: {
        id: pendingSubscription.id,
      },
      data: {
        packageId,
        billingCycle,
        setupFeeSnapshot: pkg.setupFee,
        priceMonthlySnapshot: pkg.priceMonthly,
        priceYearlySnapshot: pkg.priceYearly,
        featuresSnapshot,
        limitsSnapshot,
        startDate,
        endDate,
      },
    });
  } else {
    subscription = await prisma.subscription.create({
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
        setupFeePaid: false,
        version: 1,
        creditBalance: 0,
      },
    });
  }

  const payment = await subscriptionService.initiatePayment({
    subscriptionId: subscription.id,
    paymentMethod,
    gateway,
    phone,
    couponId,
    userId,
  });

  await auditHelper.logAudit({
    businessId,
    userId,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    action: pendingSubscription ? 'UPDATE' : 'CREATE',
    metadata: {
      packageCode: pkg.code,
      billingCycle,
      reusedPendingSubscription: !!pendingSubscription,
      paymentInitiated: true,
    },
  });

  return {
    subscription,
    onboarding: {
      paymentRequired: true,
      payment,
    },
  };
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
  if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
    throw new AppError('subscription.invalid_billing_cycle', 400);
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId },
    include: { package: true },
  });

  if (!subscription) {
    throw new AppError('subscription.not_found', 404);
  }

  if (
    ![SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE].includes(
      subscription.status,
    )
  ) {
    throw new AppError('subscription.not_active', 403);
  }

  if (subscription.packageId === packageId) {
    throw new AppError('subscription.same_package', 400);
  }

  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.isActive) {
    throw new AppError('subscription.package_not_available', 404);
  }

  if (
    !Number.isInteger(pkg.setupFee) ||
    !Number.isInteger(pkg.priceMonthly) ||
    (pkg.priceYearly !== null &&
      pkg.priceYearly !== undefined &&
      !Number.isInteger(pkg.priceYearly))
  ) {
    throw new AppError('subscription.invalid_package_pricing', 500);
  }

  if (billingCycle === 'YEARLY' && !pkg.priceYearly) {
    throw new AppError('subscription.yearly_not_available', 400);
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
      subscription.billingCycle === 'YEARLY'
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot;

    const totalDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;
    const dailyRate = oldPrice / totalDays;

    credit = Math.floor(dailyRate * remainingDays);
  }

  const featuresSnapshot = pkg.features || {};
  const limitsSnapshot = pkg.limits || {};

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
  } catch {
    throw new AppError('subscription.concurrent_update_detected', 409);
  }

  await auditHelper.logAudit({
    businessId,
    userId,
    entityType: 'SUBSCRIPTION',
    entityId: subscriptionId,
    action: 'UPGRADE',
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
    throw new AppError('subscription.not_found', 404);
  }

  if (subscription.status === 'CANCELLED') {
    throw new AppError('subscription.already_cancelled', 400);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELLED',
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
    throw new AppError('subscription.invalid_extension_days', 400);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError('subscription.not_found', 404);
  }

  const currentExpiry = subscription.expiresAt || new Date();

  const newExpiry = new Date(currentExpiry);
  newExpiry.setDate(newExpiry.getDate() + Number(days));

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      expiresAt: newExpiry,
      status: 'ACTIVE',
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
    throw new AppError('subscription.not_found', 404);
  }

  const now = new Date();

  const inGrace =
    subscription.status === 'GRACE' &&
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
    throw new AppError('subscription.invalid_grace_days', 400);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError('subscription.not_found', 404);
  }

  const currentGrace = subscription.graceUntil || new Date();

  const newGrace = new Date(currentGrace);
  newGrace.setDate(newGrace.getDate() + Number(days));

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'GRACE',
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

/*
|--------------------------------------------------------------------------
| GET ACTIVE PACKAGES (UI READY)
|--------------------------------------------------------------------------
*/
const formatMoney = (value) => {
  if (value === null || value === undefined) return null;

  return `TZS ${Number(value).toLocaleString('en-US')}`;
};

const formatLimitValue = (key, value) => {
  if (value === null || value === undefined) {
    return 'Unlimited';
  }

  if (key === 'maxBranches') {
    return Number(value) === 1 ? '1 branch' : `${value} branches`;
  }

  if (key === 'maxUsers') {
    return Number(value) === 1 ? '1 user' : `${value} users`;
  }

  if (key === 'maxMonthlySms') {
    return `${Number(value).toLocaleString('en-US')} / month`;
  }

  return value;
};

exports.getActivePackages = async () => {
  const packages = await prisma.subscriptionPackage.findMany({
    where: {
      isActive: true,
      isDeleted: false,
    },
    orderBy: { priceMonthly: 'asc' },
  });

  return packages.map((pkg) => {
    const yearlyFullPrice =
      pkg.priceMonthly && pkg.priceYearly ? pkg.priceMonthly * 12 : null;

    const hasYearlyDiscount =
      yearlyFullPrice && pkg.priceYearly && pkg.priceYearly < yearlyFullPrice;

    const discountPercent = hasYearlyDiscount
      ? Math.round(
          ((yearlyFullPrice - pkg.priceYearly) / yearlyFullPrice) * 100,
        )
      : 0;

    return {
      id: pkg.id,
      code: pkg.code,
      key: String(pkg.code).toLowerCase(),
      name: pkg.name,
      description: pkg.description,

      priceMonthly: pkg.priceMonthly,
      priceYearly: pkg.priceYearly,
      setupFee: pkg.setupFee,

      display: {
        monthlyPrice: formatMoney(pkg.priceMonthly),
        yearlyPrice: formatMoney(pkg.priceYearly),
        monthlyEquivalent: pkg.priceMonthly
          ? `${formatMoney(pkg.priceMonthly)} / month`
          : null,
        originalYearlyPrice: yearlyFullPrice
          ? formatMoney(yearlyFullPrice)
          : null,
        discount: discountPercent > 0 ? `${discountPercent}% OFF` : null,
      },

      features: pkg.features || {},
      limits: pkg.limits || {},

      values: {
        branches: formatLimitValue('maxBranches', pkg.limits?.maxBranches),
        users: formatLimitValue('maxUsers', pkg.limits?.maxUsers),
        contracts: formatLimitValue('maxContracts', pkg.limits?.maxContracts),

        customers: Boolean(pkg.features?.hasCustomerManagement),
        payments: Boolean(pkg.features?.hasInstallmentPayments),
        portal: Boolean(pkg.features?.hasCustomerPortal),
        basicAnalytics: Boolean(pkg.features?.hasBasicAnalytics),
        advancedAnalytics: Boolean(pkg.features?.hasAdvancedAnalytics),
        sms: pkg.features?.hasSmsNotification
          ? formatLimitValue('maxMonthlySms', pkg.limits?.maxMonthlySms)
          : false,
        whatsapp: Boolean(pkg.features?.hasWhatsappNotification),
        importCustomers: Boolean(pkg.features?.hasCustomerImport),
        audit: Boolean(pkg.features?.hasAuditLogs),
        tickets: Boolean(pkg.features?.hasSupportTickets),
        prioritySupport: Boolean(pkg.features?.hasPrioritySupport),
      },

      isPopular: pkg.code === 'GROWTH',
    };
  });
};
