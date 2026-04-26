const prisma = require("../config/prisma");
const AppError = require("./AppError");

/**
 * 🔒 Lock user account manually
 */
exports.lockUserAccount = async ({
  userId,
  durationMs,
  reason = "MANUAL_LOCK",
  actorId = null, // admin performing action
}) => {
  const lockUntil = new Date(Date.now() + durationMs);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      lockUntil,
      // 🔴 invalidate all existing JWTs
      tokenVersion: {
        increment: 1,
      },
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
 * 🔓 Unlock user account manually
 */
exports.unlockUserAccount = async ({ userId, actorId = null }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      lockUntil: null,
    },
  });

  return {
    userId: user.id,
    unlocked: true,
    actorId,
  };
};

/**
 * 🚫 Check if user is locked
 */
exports.assertUserNotLocked = (user) => {
  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new AppError("auth.accountLocked", 403);
  }
};

// 🔴 SUSPICIOUS TRANSACTION ENGINE (SHARED)
const { handleSecurityEvent } = require("./incidentEngine");

const SUSPICIOUS_LIMIT = 3;
const WINDOW_MS = 5 * 60 * 1000;
const LOCK_DURATION_MS = 30 * 60 * 1000;

exports.handleSuspiciousTransaction = async ({
  tx,
  amount,
  expectedAmount,
  referenceId,
  userId,
  context,
}) => {
  if (!amount || !expectedAmount) return;

  const deviationRatio = amount / expectedAmount;

  // 🔴 DETECTION: LARGE AMOUNT
  if (amount > expectedAmount * 2) {
    await handleSecurityEvent({
      type: "SUSPICIOUS_TRANSACTION",
      title: "Large transaction detected",
      source: "API",
      referenceId,
      metadata: {
        type: "LARGE_AMOUNT",
        amount,
        expectedAmount,
        ratio: deviationRatio,
        context,
      },
    });
  }

  // 🔴 DETECTION: AMOUNT DEVIATION
  if (deviationRatio > 1.5 || deviationRatio < 0.5) {
    await handleSecurityEvent({
      type: "SUSPICIOUS_TRANSACTION",
      title: "Amount deviation detected",
      source: "API",
      referenceId,
      metadata: {
        type: "AMOUNT_DEVIATION",
        amount,
        expectedAmount,
        deviationRatio,
        context,
      },
    });
  }

  // 🔴 COUNT RECENT INCIDENTS
  const recentSuspiciousCount = await tx.securityIncident.count({
    where: {
      type: "SUSPICIOUS_TRANSACTION",
      referenceId,
      createdAt: {
        gte: new Date(Date.now() - WINDOW_MS),
      },
    },
  });

  // 🔴 LOCK USER
  if (recentSuspiciousCount >= SUSPICIOUS_LIMIT) {
    const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);

    await tx.user.update({
      where: { id: userId },
      data: {
        lockUntil,
        tokenVersion: {
          increment: 1,
        },
      },
    });

    await handleSecurityEvent({
      type: "ACCOUNT_LOCKED",
      title: "User locked due to suspicious activity",
      source: "SYSTEM",
      referenceId: userId,
      metadata: {
        reason: "MULTIPLE_SUSPICIOUS_TRANSACTIONS",
        lockUntil,
        count: recentSuspiciousCount,
        context,
      },
    });
  }
};
