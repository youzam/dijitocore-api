const prisma = require("../../../config/prisma");

async function seedDefaultPackages() {
  const existing = await prisma.subscriptionPackage.count();

  if (existing > 0) return;

  await prisma.subscriptionPackage.createMany({
    data: [
      {
        name: "Starter",
        code: "STARTER",
        description: "Starter plan",
        priceMonthly: 20000,
        setupFee: 0,
        trialDays: 7,
        features: {
          maxCustomers: 100,
          allowImport: false,
          allowSMS: false,
        },
      },
      {
        name: "Pro",
        code: "PRO",
        description: "Professional plan",
        priceMonthly: 50000,
        setupFee: 10000,
        trialDays: 14,
        features: {
          maxCustomers: 500,
          allowImport: true,
          allowSMS: true,
        },
      },
      {
        name: "Premium",
        code: "PREMIUM",
        description: "Premium plan",
        priceMonthly: 100000,
        setupFee: 20000,
        trialDays: 14,
        features: {
          maxCustomers: -1,
          allowImport: true,
          allowSMS: true,
        },
      },
    ],
  });
}

module.exports = {
  seedDefaultPackages,
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

/* =====================================================
   PACKAGE CONFIGURATION ENGINE (ADMIN SAFE UPDATE)
===================================================== */

function sanitizeFeatures(input = {}) {
  const clean = {};
  const allowedKeys = registry.getFeatureKeys();

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = input[key];

      if (typeof value === "boolean") {
        clean[key] = value;
      }
    }
  }

  return clean;
}

function sanitizeLimits(input = {}) {
  const clean = {};
  const allowedKeys = registry.getLimitKeys();

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = input[key];

      if (value === null) {
        clean[key] = null; // unlimited
      } else if (typeof value === "number" && value >= 0) {
        clean[key] = value;
      }
    }
  }

  return clean;
}

function deepMergeValidated(existing = {}, updates = {}) {
  return {
    ...existing,
    ...updates,
  };
}

exports.updatePackageConfiguration = async (packageId, payload) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id: packageId },
  });

  if (!existing) {
    throw new AppError("subscription.package_not_found", 404);
  }

  const sanitizedFeatures = sanitizeFeatures(payload.features || {});
  const sanitizedLimits = sanitizeLimits(payload.limits || {});

  const mergedFeatures = deepMergeValidated(
    existing.features || {},
    sanitizedFeatures,
  );

  const mergedLimits = deepMergeValidated(
    existing.limits || {},
    sanitizedLimits,
  );

  const updated = await prisma.subscriptionPackage.update({
    where: { id: packageId },
    data: {
      features: mergedFeatures,
      limits: mergedLimits,
      updatedAt: new Date(),
    },
  });

  return updated;
};

/* ======================================================
   ADMIN MANUAL CONFIRM (SECURE OVERRIDE)
====================================================== */

exports.adminManualConfirm = async ({ paymentId, userId }) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { subscription: true },
  });

  if (!payment) {
    throw new AppError("subscription.payment_not_found", 404);
  }

  if (payment.status === "CONFIRMED") {
    return payment;
  }

  if (payment.status !== "PENDING") {
    throw new AppError("payment.invalid_state", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });

    const freshSubscription = await tx.subscription.findUnique({
      where: { id: payment.subscriptionId },
    });

    const isInitial = !freshSubscription.setupFeePaid;

    await activateSubscriptionEngine(tx, freshSubscription, payment, isInitial);

    await auditHelper.logAudit({
      tx,
      businessId: payment.businessId,
      userId,
      entityType: "SUBSCRIPTION_PAYMENT",
      entityId: payment.id,
      action: "ADMIN_MANUAL_CONFIRM",
    });
  });

  return payment;
};

/* ======================================================
   RECONCILE PAYMENT
====================================================== */
exports.reconcilePayment = async ({ paymentId, userId }) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { subscription: true },
  });

  if (!payment) {
    throw new AppError("subscription.payment_not_found", 404);
  }

  if (payment.status === "CONFIRMED") {
    return payment;
  }

  if (!payment.externalTransactionId) {
    throw new AppError("payment.no_external_reference", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });

    const freshSubscription = await tx.subscription.findUnique({
      where: { id: payment.subscriptionId },
    });

    const isInitial = !freshSubscription.setupFeePaid;

    await activateSubscriptionEngine(tx, freshSubscription, payment, isInitial);
  });

  await auditHelper.logAudit({
    businessId: payment.businessId,
    userId,
    entityType: "SUBSCRIPTION_PAYMENT",
    entityId: payment.id,
    action: "PAYMENT_RECONCILED",
  });

  return payment;
};
