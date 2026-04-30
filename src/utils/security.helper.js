const prisma = require("../config/prisma");
const AppError = require("./AppError");
const { logAudit } = require("./audit.helper");

/**
 * =====================================================
 * GET LOCK DURATION FROM SETTINGS
 * =====================================================
 */
async function getLockDuration(tx) {
  const settings = await tx.systemSetting.findFirst({
    select: { lockTimeMinutes: true },
  });

  const minutes = settings?.lockTimeMinutes || 30; // fallback
  return minutes * 60 * 1000;
}

/**
 * =====================================================
 * LOCK USER ACCOUNT (AUDIT-DRIVEN)
 * =====================================================
 */
exports.lockUserAccount = async ({
  tx,
  userId,
  businessId = null,
  reason = "MANUAL_LOCK",
  actorId = null,
  context = "SYSTEM",
}) => {
  const duration = await getLockDuration(tx);
  const lockUntil = new Date(Date.now() + duration);

  const user = await tx.user.update({
    where: { id: userId },
    data: {
      lockUntil,
      tokenVersion: {
        increment: 1,
      },
    },
  });

  // 🔴 AUDIT LOG
  await logAudit({
    tx,
    businessId,
    userId: actorId,
    entityType: "USER",
    entityId: userId,
    action: "USER_LOCKED",
    module: "SECURITY",
    actorType: "ADMIN",
    metadata: {
      reason,
      context,
      lockUntil,
    },
  });

  return {
    userId: user.id,
    lockUntil,
    reason,
    actorId,
  };
};

/**
 * =====================================================
 * UNLOCK USER ACCOUNT (AUDIT-DRIVEN)
 * =====================================================
 */
exports.unlockUserAccount = async ({
  tx,
  userId,
  businessId = null,
  actorId = null,
  context = "SYSTEM",
}) => {
  const user = await tx.user.update({
    where: { id: userId },
    data: {
      lockUntil: null,
    },
  });

  // 🔴 AUDIT LOG
  await logAudit({
    tx,
    businessId,
    userId: actorId,
    entityType: "USER",
    entityId: userId,
    action: "USER_UNLOCKED",
    module: "SECURITY",
    actorType: "ADMIN",
    metadata: {
      context,
    },
  });

  return {
    userId: user.id,
    unlocked: true,
    actorId,
  };
};

/**
 * =====================================================
 * ASSERT USER NOT LOCKED
 * =====================================================
 */
exports.assertUserNotLocked = (user) => {
  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new AppError("auth.accountLocked", 403);
  }
};

/**
 * =====================================================
 * SUSPICIOUS TRANSACTION ENGINE (AUDIT-DRIVEN)
 * =====================================================
 */
const SUSPICIOUS_LIMIT = 3;
const WINDOW_MS = 5 * 60 * 1000;

exports.handleSuspiciousTransaction = async ({
  tx,
  amount,
  expectedAmount,
  referenceId,
  userId,
  businessId = null,
  context,
}) => {
  // 🔒 SAFE GUARD
  if (!amount || !expectedAmount || !userId) return;

  const deviationRatio = amount / expectedAmount;

  /**
   * =====================================================
   * 🔥 ADVANCED DETECTION LAYER (NEW)
   * =====================================================
   */

  // 1. High deviation
  const isHighDeviation = deviationRatio > 1.5 || deviationRatio < 0.5;

  // 2. Extreme underpay (bypass attempt)
  const isExtremeUnderpay = amount < expectedAmount * 0.2;

  // 3. Rapid-fire transactions (spam)
  const recentPayments = await tx.subscriptionPayment.count({
    where: {
      businessId,
      createdAt: {
        gte: new Date(Date.now() - 2 * 60 * 1000), // last 2 min
      },
    },
  });

  const isRapidFire = recentPayments >= 5;

  // 4. Zero abuse (free activation exploit)
  const isZeroAbuse = amount === 0 && expectedAmount > 0;

  /**
   * =====================================================
   * 🔹 ORIGINAL DETECTION (KEPT)
   * =====================================================
   */

  if (amount > expectedAmount * 2) {
    await logAudit({
      tx,
      businessId,
      userId,
      entityType: "SECURITY",
      entityId: referenceId,
      action: "SUSPICIOUS_TRANSACTION",
      module: "SECURITY",
      actorType: "TENANT",
      metadata: {
        type: "LARGE_AMOUNT",
        amount,
        expectedAmount,
        ratio: deviationRatio,
        context,
      },
    });
  }

  if (deviationRatio > 1.5 || deviationRatio < 0.5) {
    await logAudit({
      tx,
      businessId,
      userId,
      entityType: "SECURITY",
      entityId: referenceId,
      action: "SUSPICIOUS_TRANSACTION",
      module: "SECURITY",
      actorType: "TENANT",
      metadata: {
        type: "AMOUNT_DEVIATION",
        amount,
        expectedAmount,
        deviationRatio,
        context,
      },
    });
  }

  /**
   * =====================================================
   * 🔥 NEW COMBINED DETECTION
   * =====================================================
   */
  if (isHighDeviation || isExtremeUnderpay || isRapidFire || isZeroAbuse) {
    await logAudit({
      tx,
      businessId,
      userId,
      entityType: "SECURITY",
      entityId: referenceId,
      action: "SUSPICIOUS_TRANSACTION",
      module: "SECURITY",
      actorType: "TENANT",
      metadata: {
        type: "ADVANCED_DETECTION",
        amount,
        expectedAmount,
        deviationRatio,
        isHighDeviation,
        isExtremeUnderpay,
        isRapidFire,
        isZeroAbuse,
        context,
      },
    });
  }

  /**
   * =====================================================
   * 🔹 COUNT RECENT INCIDENTS (UNCHANGED)
   * =====================================================
   */
  const recentSuspiciousCount = await tx.auditLog.count({
    where: {
      action: "SUSPICIOUS_TRANSACTION",
      entityId: referenceId,
      createdAt: {
        gte: new Date(Date.now() - WINDOW_MS),
      },
    },
  });

  /**
   * =====================================================
   * 🔥 LOCK USER (ENHANCED)
   * =====================================================
   */
  if (recentSuspiciousCount >= SUSPICIOUS_LIMIT || isRapidFire) {
    const duration = await getLockDuration(tx);
    const lockUntil = new Date(Date.now() + duration);

    await tx.user.update({
      where: { id: userId },
      data: {
        lockUntil,
        tokenVersion: {
          increment: 1,
        },
      },
    });

    await logAudit({
      tx,
      businessId,
      userId,
      entityType: "USER",
      entityId: userId,
      action: "USER_LOCKED",
      module: "SECURITY",
      actorType: "ADMIN",
      metadata: {
        reason: "SUSPICIOUS_ACTIVITY",
        count: recentSuspiciousCount,
        lockUntil,
        context,
      },
    });
  }
};
