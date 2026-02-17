const crypto = require("crypto");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const auditHelper = require("../../utils/audit.helper");
const gatewayManager = require("../../utils/paymentGateway/gateway.manager");
const { SubscriptionStatus } = require("@prisma/client");

/* ======================================================
   OPTIONAL SIGNATURE VERIFY (NON-BREAKING)
====================================================== */
const verifySignatureIfProvided = (payloadHash) => {
  if (!process.env.GATEWAY_WEBHOOK_SECRET) return true;
  if (!payloadHash) return false;

  const secret = process.env.GATEWAY_WEBHOOK_SECRET;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(String(payloadHash))
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(String(payloadHash));

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};

/* ======================================================
   INTERNAL ACTIVATION ENGINE (WITH VERSION LOCK)
====================================================== */

const activateSubscriptionEngine = async (
  tx,
  subscription,
  payment,
  isInitial,
) => {
  const now = new Date();
  const durationDays = subscription.billingCycle === "YEARLY" ? 365 : 30;

  const baseVersion = subscription.version;

  if (isInitial) {
    const newEndDate = new Date(now.getTime() + durationDays * 86400000);

    await tx.subscription.update({
      where: {
        id: subscription.id,
        version: baseVersion,
      },
      data: {
        setupFeePaid: true,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate: newEndDate,
        graceUntil: null,
        creditBalance: 0,
        version: { increment: 1 },
      },
    });

    await tx.business.update({
      where: { id: subscription.businessId },
      data: {
        setupCompleted: true,
        status: "ACTIVE",
      },
    });

    return;
  }

  /* ======================================================
     RENEWAL FLOW
  ====================================================== */

  const baseDate =
    subscription.endDate && subscription.endDate > now
      ? subscription.endDate
      : now;

  const extendedEndDate = new Date(
    baseDate.getTime() + durationDays * 86400000,
  );

  const pkg = await tx.subscriptionPackage.findUnique({
    where: { id: subscription.packageId },
  });

  const updateData = {
    status: SubscriptionStatus.ACTIVE,
    endDate: extendedEndDate,
    graceUntil: null,
    creditBalance: 0,
    version: { increment: 1 },
  };

  if (pkg) {
    const packageChanged = pkg.updatedAt > subscription.updatedAt;

    if (packageChanged) {
      // Stage detection using version parity
      const adoptionStage = subscription.version % 2;

      // Always update feature & limit snapshots on package change
      updateData.featuresSnapshot = pkg.features || {};
      updateData.limitsSnapshot = pkg.limits || {};

      if (adoptionStage === 1) {
        // SECOND renewal → adopt new pricing
        updateData.priceMonthlySnapshot = pkg.priceMonthly;
        updateData.priceYearlySnapshot = pkg.priceYearly;
      }
      // FIRST renewal → pricing untouched
    }
  }

  await tx.subscription.update({
    where: {
      id: subscription.id,
      version: baseVersion,
    },
    data: updateData,
  });

  await tx.business.update({
    where: { id: subscription.businessId },
    data: { status: "ACTIVE" },
  });
};

/* ======================================================
   INITIATE PAYMENT (WITH CREDIT SUPPORT)
====================================================== */
exports.initiatePayment = async ({ businessId, subscriptionId, userId }) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  if (subscription.status === SubscriptionStatus.SUSPENDED) {
    throw new AppError("subscription.not_active", 403);
  }

  const pending = await prisma.subscriptionPayment.findFirst({
    where: {
      subscriptionId,
      status: "PENDING",
    },
  });

  if (pending) {
    throw new AppError("subscription.payment_pending_exists", 400);
  }

  const isInitial = !subscription.setupFeePaid;

  let baseAmount;

  if (isInitial) {
    baseAmount =
      subscription.setupFeeSnapshot +
      (subscription.billingCycle === "YEARLY"
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot);
  } else {
    baseAmount =
      subscription.billingCycle === "YEARLY"
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot;
  }

  if (!Number.isInteger(baseAmount) || baseAmount < 0) {
    throw new AppError("payment.invalid_amount", 500);
  }

  let finalAmount = baseAmount;

  if (subscription.creditBalance > 0) {
    finalAmount = Math.max(0, baseAmount - subscription.creditBalance);
  }

  const systemSetting = await prisma.systemSetting.findFirst();
  if (!systemSetting) {
    throw new AppError("system.settings_missing", 500);
  }

  const activeGateway = systemSetting.activePaymentGateway;
  const supportedGateways = ["SELCOM", "MPESA", "AIRTEL"];

  if (!supportedGateways.includes(activeGateway)) {
    throw new AppError("payment.invalid_gateway", 500);
  }

  const healthService = require("../../utils/paymentGateway/gateway.health");
  const gatewayStatus = await healthService.getStatus(activeGateway);

  if (gatewayStatus === "DOWN") {
    throw new AppError("payment.provider_down", 503);
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId,
      businessId,
      amount: finalAmount,
      method: activeGateway,
      status: "PENDING",
    },
  });

  const gatewayResponse = await gatewayManager.initiate({
    provider: activeGateway,
    amount: finalAmount,
    reference: payment.id,
    businessId,
  });

  await auditHelper.logAudit({
    businessId,
    userId,
    entityType: "SUBSCRIPTION_PAYMENT",
    entityId: payment.id,
    action: isInitial ? "INITIAL_PAYMENT" : "RENEWAL_PAYMENT",
    metadata: {
      gateway: activeGateway,
      baseAmount,
      creditUsed: baseAmount - finalAmount,
    },
  });

  return gatewayResponse;
};

/* ======================================================
   WEBHOOK PROCESSOR
====================================================== */

exports.processGatewayWebhook = async ({
  reference,
  externalTransactionId,
  amount,
  payloadHash,
}) => {
  if (!verifySignatureIfProvided(payloadHash)) {
    throw new AppError("payment.invalid_signature", 401);
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: reference },
      include: { subscription: true },
    });

    if (!payment) {
      throw new AppError("subscription.payment_not_found", 404);
    }

    if (payment.status === "CONFIRMED") {
      return;
    }

    if (payment.status !== "PENDING") {
      throw new AppError("payment.invalid_state", 400);
    }

    if (!Number.isInteger(amount) || payment.amount !== amount) {
      throw new AppError("payment.amount_mismatch", 400);
    }

    if (externalTransactionId) {
      const existing = await tx.subscriptionPayment.findFirst({
        where: { externalTransactionId },
      });

      if (existing && existing.id !== payment.id) {
        throw new AppError("payment.duplicate_transaction", 409);
      }
    }

    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        paidAt: new Date(),
        externalTransactionId,
        gatewayPayloadHash: payloadHash,
      },
    });

    const freshSubscription = await tx.subscription.findUnique({
      where: { id: payment.subscriptionId },
    });

    if (!freshSubscription) {
      throw new AppError("subscription.not_found", 404);
    }

    const isInitial = !freshSubscription.setupFeePaid;

    await activateSubscriptionEngine(tx, freshSubscription, payment, isInitial);
  });

  return true;
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
