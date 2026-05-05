const crypto = require('crypto');
const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const auditHelper = require('../../utils/audit.helper');
const gatewayManager = require('../../utils/paymentGateway/gateway.manager');
const couponService = require('./subscription.coupon.service');
const { SubscriptionStatus } = require('@prisma/client');
const { handleSuspiciousTransaction } = require('../../utils/security.helper');
const {
  SUPPORTED_PAYMENT_GATEWAYS,
} = require('../../utils/paymentGateway/supportedGateways');
const env = require('../../config/env');

/* ======================================================
   OPTIONAL SIGNATURE VERIFY (NON-BREAKING)
====================================================== */
const verifySignatureIfProvided = (payloadHash) => {
  if (!env.webhooks.gatewaySecret) return true;
  if (!payloadHash) return false;

  const secret = env.webhooks.gatewaySecret;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(String(payloadHash))
    .digest('hex');

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
  const durationDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;

  const baseVersion = subscription.version;

  // 🔥 PREVENT ACTIVATION IF IN REFUND GRACE
  if (subscription.graceUntil && subscription.graceUntil > new Date()) {
    return;
  }

  if (isInitial) {
    const newEndDate = new Date(now.getTime() + durationDays * 86400000);

    // =====================================================
    // 🔥 LOAD PACKAGE FOR SNAPSHOT (INITIAL)
    // =====================================================
    const pkg = await tx.subscriptionPackage.findUnique({
      where: { id: subscription.packageId },
      select: {
        features: true,
        limits: true,
      },
    });

    if (!pkg) {
      throw new AppError('subscription.package_not_found', 404);
    }

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
        // 🔥 APPLY SNAPSHOT HERE
        featuresSnapshot: pkg.features || {},
        limitsSnapshot: pkg.limits || {},

        version: { increment: 1 },
      },
    });

    await tx.business.update({
      where: { id: subscription.businessId },
      data: {
        setupCompleted: true,
        status: 'ACTIVE',
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
    data: { status: 'ACTIVE' },
  });
};

/* ======================================================
   INITIATE PAYMENT (WITH CREDIT SUPPORT)
====================================================== */
exports.initiatePayment = async ({
  businessId,
  subscriptionId,
  userId,
  couponId = null,
  paymentMethod,
  phone,
}) => {
  return prisma.$transaction(async (tx) => {
    // 🔒 SAFE ROW LOCK (FIXED)
    await tx.$executeRaw`
      SELECT id FROM "Subscription" WHERE id = ${subscriptionId} FOR UPDATE
    `;

    const subscription = await tx.subscription.findFirst({
      where: { id: subscriptionId, businessId },
    });

    if (!subscription) {
      throw new AppError('subscription.not_found', 404);
    }

    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new AppError('subscription.not_active', 403);
    }

    // 🔥 USER CHECK (FIXED phone issue)
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { lockUntil: true },
    });

    if (user?.lockUntil && user.lockUntil > new Date()) {
      throw new AppError('auth.accountLocked', 403);
    }

    if (!paymentMethod) {
      throw new AppError('payment.method_required', 400);
    }

    if ((paymentMethod === 'MPESA' || paymentMethod === 'AIRTEL') && !phone) {
      throw new AppError('payment.phone_required', 400);
    }

    // 🔒 Prevent duplicate pending
    const pending = await tx.subscriptionPayment.findFirst({
      where: { subscriptionId, status: 'PENDING' },
    });

    if (pending) {
      throw new AppError('subscription.payment_pending_exists', 400);
    }

    // 🔥 RATE LIMIT
    const recentAttempts = await tx.subscriptionPayment.count({
      where: {
        businessId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentAttempts >= 3) {
      throw new AppError('payment.too_many_requests', 429);
    }

    const isInitial = !subscription.setupFeePaid;

    // 🔹 BASE AMOUNT
    let baseAmount =
      subscription.billingCycle === 'YEARLY'
        ? subscription.priceYearlySnapshot
        : subscription.priceMonthlySnapshot;

    if (isInitial) {
      baseAmount += subscription.setupFeeSnapshot;
    }

    if (!Number.isInteger(baseAmount) || baseAmount < 0) {
      throw new AppError('payment.invalid_amount', 500);
    }

    // 🔹 ADJUSTMENTS
    let adjustmentTotal = 0;

    const adjustments = await tx.financialAdjustment.findMany({
      where: {
        businessId: subscription.businessId,
        isApplied: false,
      },
    });

    const adjustmentIds = [];

    for (const adj of adjustments) {
      adjustmentIds.push(adj.id);

      if (adj.type === 'CREDIT') {
        adjustmentTotal -= Number(adj.amount);
      } else {
        adjustmentTotal += Number(adj.amount);
      }
    }

    let calculatedAmount = baseAmount + adjustmentTotal;

    // 🔹 APPLY CREDIT
    if (subscription.creditBalance > 0) {
      calculatedAmount = Math.max(
        0,
        calculatedAmount - subscription.creditBalance,
      );
    }

    // 🔹 COUPON
    if (couponId) {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
      });

      if (!coupon) {
        throw new AppError('coupon.not_found', 404);
      }

      const result = await couponService.applyCouponForCheckout({
        code: coupon.code,
        businessId: subscription.businessId,
        amount: calculatedAmount,
      });

      calculatedAmount = Math.max(0, calculatedAmount - result.discount);
    }

    const safeAmount = Math.max(0, calculatedAmount);

    // 🔥 DUPLICATE AMOUNT PROTECTION
    const recentSameAmount = await tx.subscriptionPayment.findFirst({
      where: {
        businessId,
        amount: safeAmount,
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
    });

    if (recentSameAmount) {
      throw new AppError('payment.duplicate_attempt', 400);
    }

    const systemSetting = await tx.systemSetting.findFirst();

    if (!systemSetting) {
      throw new AppError('system.settings_missing', 500);
    }

    // 🔥 GATEWAY VALIDATION
    if (!SUPPORTED_PAYMENT_GATEWAYS.includes(paymentMethod)) {
      throw new AppError('payment.invalid_gateway', 400);
    }

    const paymentGatewayService = require('../paymentGateway/paymentGateway.service');

    const availableGateways =
      await paymentGatewayService.getActivePaymentGateways();

    if (!availableGateways.includes(paymentMethod)) {
      throw new AppError('payment.gateway_not_available', 400);
    }

    const normalizePhone = (phone) => {
      if (!phone) return null;

      let normalized = phone.replace(/\s+/g, '');

      if (normalized.startsWith('+255')) {
        normalized = '0' + normalized.slice(4);
      } else if (normalized.startsWith('255')) {
        normalized = '0' + normalized.slice(3);
      }

      return normalized;
    };

    const cleanPhone = normalizePhone(phone);

    const {
      detectNetwork,
    } = require('../../utils/paymentGateway/phoneNetwork.helper');

    if (paymentMethod === 'MPESA' || paymentMethod === 'AIRTEL') {
      if (!cleanPhone || !/^0\d{9}$/.test(cleanPhone)) {
        throw new AppError('payment.invalid_phone_format', 400);
      }

      const detectedNetwork = detectNetwork(cleanPhone);

      if (!detectedNetwork || detectedNetwork === 'UNKNOWN') {
        throw new AppError('payment.invalid_phone_network', 400);
      }

      if (paymentMethod !== detectedNetwork) {
        throw new AppError('payment.phone_network_mismatch', 400);
      }
    }

    const systemGateways = systemSetting.activePaymentGateways || [];

    if (!systemGateways.includes(paymentMethod)) {
      throw new AppError('payment.gateway_not_allowed', 403);
    }

    const finalGateway = paymentMethod;

    const healthService = require('../../utils/paymentGateway/gateway.health');

    const gatewayStatus = await healthService.getStatus(finalGateway);

    if (gatewayStatus !== 'UP') {
      throw new AppError('payment.provider_down', 503);
    }

    // 🔥 ZERO FLOW
    if (safeAmount === 0) {
      const payment = await tx.subscriptionPayment.create({
        data: {
          subscriptionId,
          businessId,
          amount: 0,
          method: 'SYSTEM',
          status: 'CONFIRMED',
          paidAt: new Date(),
          metadata: {
            adjustmentIds,
            baseAmount,
            calculatedAmount,
          },
        },
      });

      await activateSubscriptionEngine(tx, subscription, payment, isInitial);

      return {
        success: true,
        skippedGateway: true,
        paymentId: payment.id,
      };
    }

    // 🔥 NORMAL FLOW (FIXED activeGateway bug)
    const payment = await tx.subscriptionPayment.create({
      data: {
        subscriptionId,
        businessId,
        amount: safeAmount,
        method: finalGateway,
        status: 'PENDING',
        couponId: couponId || null,
        metadata: {
          adjustmentIds,
          baseAmount,
          calculatedAmount,
        },
      },
    });

    const gatewayResponse = await gatewayManager.initiate({
      provider: finalGateway,
      amount: safeAmount,
      reference: payment.id,
      businessId,
      phone: cleanPhone, // 🔥 FIXED
    });

    await auditHelper.logAudit({
      businessId,
      userId,
      entityType: 'SUBSCRIPTION_PAYMENT',
      entityId: payment.id,
      action: isInitial ? 'INITIAL_PAYMENT' : 'RENEWAL_PAYMENT',
      metadata: {
        gateway: finalGateway,
        finalAmount: safeAmount,
      },
    });

    return gatewayResponse;
  });
};

/* ======================================================
   WEBHOOK PROCESSOR
====================================================== */

exports.processGatewayWebhook = async (payload, headers = {}) => {
  return prisma.$transaction(async (tx) => {
    // =====================================================
    // 🔹 1. FIND PAYMENT
    // =====================================================
    const payment = await tx.subscriptionPayment.findFirst({
      where: { id: payload.reference },
      include: { subscription: true },
    });

    if (!payment) {
      throw new AppError('payment.not_found', 404);
    }

    // =====================================================
    // 🔹 2. GATEWAY SIGNATURE VERIFICATION
    // =====================================================
    if (!verifySignatureIfProvided(headers['x-signature'])) {
      throw new AppError('webhook.invalid_signature', 401);
    }

    // =====================================================
    // 🔹 3. REPLAY PROTECTION
    // =====================================================
    if (payment.webhookProcessedAt) {
      return {
        success: true,
        message: 'Webhook already processed',
      };
    }

    // =====================================================
    // 🔹 4. STRICT IDEMPOTENCY
    // =====================================================
    if (payment.status !== 'PENDING') {
      return {
        success: true,
        message: 'Already processed',
      };
    }

    // =====================================================
    // 🔹 5. TIMESTAMP VALIDATION
    // =====================================================
    if (payload.timestamp) {
      const now = Date.now();
      const eventTime = new Date(payload.timestamp).getTime();

      if (Math.abs(now - eventTime) > 5 * 60 * 1000) {
        throw new AppError('webhook.expired', 400);
      }
    }

    // =====================================================
    // 🔹 6. FAILURE HANDLING
    // =====================================================
    if (payload.status === 'FAILED') {
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          webhookProcessedAt: new Date(),
        },
      });

      await auditHelper.logAudit({
        businessId: payment.businessId,
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'PAYMENT_FAILED',
        metadata: {
          reference: payload.reference,
          gateway: payload.gateway || null,
          reason: payload.reason || null,
        },
      });

      return { success: false };
    }

    // =====================================================
    // 🔹 7. SUCCESS ONLY
    // =====================================================
    if (payload.status !== 'SUCCESS') {
      return { skipped: true };
    }

    // =====================================================
    // 🔹 8. AMOUNT VALIDATION
    // =====================================================
    if (
      payload.amount !== undefined &&
      Number(payload.amount) !== Number(payment.amount)
    ) {
      throw new AppError('payment.amount_mismatch', 400);
    }

    // =====================================================
    // 🔹 9. UPDATE PAYMENT
    // =====================================================
    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        paidAt: new Date(),
        webhookProcessedAt: new Date(),
      },
    });

    // =====================================================
    // 🔹 10. PREPARE SUBSCRIPTION CONTEXT
    // =====================================================
    const subscription = payment.subscription;
    const isInitial = !subscription.setupFeePaid;

    // =====================================================
    // 🔥 11. COUPON HANDLING (FIXED)
    // =====================================================
    if (payment.couponId) {
      const coupon = await tx.coupon.findUnique({
        where: { id: payment.couponId },
      });

      if (!coupon) {
        throw new AppError('coupon.not_found', 404);
      }

      // 🔹 DO NOT BLOCK AFTER PAYMENT SUCCESS

      await tx.coupon.update({
        where: { id: coupon.id },
        data: {
          usageCount: { increment: 1 },
        },
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          businessId: payment.businessId,
        },
      });

      // 🔥 SAVE SNAPSHOT INTO SUBSCRIPTION
      const discountResult = await couponService.applyCouponForCheckout({
        code: coupon.code,
        businessId: payment.businessId,
        amount: payment.amount,
      });

      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          couponId: coupon.id,
          couponCode: coupon.code,
          couponDiscount: discountResult.discount,
          finalAmount: payment.amount,
        },
      });
    }

    // =====================================================
    // 🔥 12. APPLY ADJUSTMENTS (LOCKED)
    // =====================================================
    const adjustmentIds = payment.metadata?.adjustmentIds || [];

    if (adjustmentIds.length > 0) {
      await tx.financialAdjustment.updateMany({
        where: {
          id: { in: adjustmentIds },
          isApplied: false,
        },
        data: {
          isApplied: true,
          appliedPaymentId: payment.id,
          appliedAt: new Date(),
        },
      });
    }

    // =====================================================
    // DETECT SUSPICIOUS TRANSACTION
    // =====================================================
    await handleSuspiciousTransaction({
      tx,
      amount: payment.amount,
      expectedAmount: payment.metadata?.expectedAmount || payment.amount,
      referenceId: payment.id,
      userId: null,
      businessId: payment.businessId,
      context: 'SUBSCRIPTION',
    });

    // =====================================================
    // 🔹 13. ACTIVATE SUBSCRIPTION (UNCHANGED)
    // =====================================================
    await activateSubscriptionEngine(tx, subscription, payment, isInitial);

    // =====================================================
    // 🔥 14. AUDIT
    // =====================================================
    await auditHelper.logAudit({
      businessId: payment.businessId,
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'PAYMENT_CONFIRMED',
      metadata: {
        status: 'CONFIRMED',
      },
    });

    // =====================================================
    // 🔹 FINAL RESPONSE
    // =====================================================
    return {
      success: true,
      paymentId: payment.id,
    };
  });
};
