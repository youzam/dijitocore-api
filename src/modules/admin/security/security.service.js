const crypto = require("crypto");
const AppError = require("../../../utils/AppError");
const prisma = require("../../../config/prisma");
const { handleSecurityEvent } = require("../../../utils/incidentEngine");
const env = require("../../../config/env");

/**
 * =====================================================
 * HELPERS
 * =====================================================
 */

const getPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  return { skip, take: limit };
};

/**
 * =====================================================
 * LOGIN ACTIVITY
 * =====================================================
 */

exports.getLoginActivities = async (query) => {
  const { skip, take } = getPagination(query);

  return prisma.loginActivity.findMany({
    where: {
      ...(query.userId && { userId: query.userId }),
      ...(query.adminId && { adminId: query.adminId }),
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * =====================================================
 * AUDIT LOGS
 * =====================================================
 */

exports.getAuditLogs = async (query) => {
  const { skip, take } = getPagination(query);

  return prisma.adminAuditLog.findMany({
    where: {
      ...(query.adminId && { adminId: query.adminId }),
      ...(query.action && { action: query.action }),
      AND: [{ before: { not: null } }, { after: { not: null } }],
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

exports.getAuditLogById = async (id) => {
  const log = await prisma.adminAuditLog.findUnique({
    where: { id },
  });

  if (!log) {
    throw new AppError("security.audit_not_found", 404);
  }

  if (!log.before || !log.after) {
    throw new AppError("Audit log missing before/after state", 500);
  }

  return log;
};

/**
 * =====================================================
 * USER SESSIONS
 * =====================================================
 */

exports.getUserSessions = async (userId, query) => {
  const { skip, take } = getPagination(query);

  return prisma.refreshToken.findMany({
    where: { userId },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

exports.revokeUserSession = async (tokenId) => {
  const token = await prisma.refreshToken.findUnique({
    where: { id: tokenId },
    select: { userId: true },
  });

  const result = await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  // 🔥 CRITICAL FIX: invalidate session kupitia auth system
  if (token?.userId) {
    await prisma.user.update({
      where: { id: token.userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });
  }

  await logAudit({
    userId: null,
    entityType: "SESSION",
    entityId: tokenId,
    action: "USER_SESSION_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};

exports.revokeAllUserSessions = async (userId) => {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // 🔥 CRITICAL FIX: invalidate ALL tokens via tokenVersion
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: { increment: 1 },
    },
  });

  await logAudit({
    userId: userId,
    entityType: "SESSION",
    entityId: userId,
    action: "ALL_USER_SESSIONS_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};

/**
 * =====================================================
 * ADMIN SESSIONS
 * =====================================================
 */

exports.getAdminSessions = async (adminId, query) => {
  const { skip, take } = getPagination(query);

  return prisma.refreshToken.findMany({
    where: { adminId },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

exports.revokeAdminSession = async (tokenId) => {
  const session = await prisma.adminSession.findFirst({
    where: { refreshToken: tokenId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  await prisma.adminSession.delete({
    where: { id: session.id },
  });

  await logAudit({
    userId: session.adminId,
    entityType: "SESSION",
    entityId: session.id,
    action: "ADMIN_SESSION_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return true;
};

exports.revokeAllAdminSessions = async (adminId) => {
  await prisma.adminSession.deleteMany({
    where: { adminId },
  });

  await logAudit({
    userId: adminId,
    entityType: "SESSION",
    entityId: adminId,
    action: "ALL_ADMIN_SESSIONS_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return true;
};

/**
 * =====================================================
 * TOKEN CONTROL
 * =====================================================
 */

exports.revokeToken = async (tokenId) => {
  const result = await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    userId: null,
    entityType: "SESSION",
    entityId: tokenId,
    action: "TOKEN_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};

/**
 * =====================================================
 * FRAUD FLAGS
 * =====================================================
 */

exports.flagUser = async (data, actor) => {
  const { targetId, targetType, reason } = data;

  // 🔒 SUPER_ADMIN ONLY
  if (actor.role !== "SUPER_ADMIN") {
    throw new AppError("Only SUPER_ADMIN can flag", 403);
  }

  let existing;

  if (targetType === "USER") {
    existing = await prisma.fraudFlag.findFirst({
      where: { userId: targetId, status: "ACTIVE" },
    });
  }

  if (targetType === "ADMIN") {
    existing = await prisma.fraudFlag.findFirst({
      where: { adminId: targetId, status: "ACTIVE" },
    });
  }

  if (targetType === "CUSTOMER") {
    existing = await prisma.fraudFlag.findFirst({
      where: { customerId: targetId, status: "ACTIVE" },
    });
  }

  if (existing) {
    throw new AppError("Already flagged", 400);
  }

  const flagData = {
    entityType: targetType,
    reason,
    status: "ACTIVE",
  };

  if (targetType === "USER") flagData.userId = targetId;
  if (targetType === "ADMIN") flagData.adminId = targetId;
  if (targetType === "CUSTOMER") flagData.customerId = targetId;

  const flag = await prisma.fraudFlag.create({ data: flagData });

  // 🔥 ENFORCEMENT

  if (targetType === "USER") {
    await prisma.user.update({
      where: { id: targetId },
      data: {
        status: "SUSPENDED",
        tokenVersion: { increment: 1 },
      },
    });
  }

  if (targetType === "ADMIN") {
    await prisma.systemAdmin.update({
      where: { id: targetId },
      data: {
        status: "SUSPENDED",
      },
    });

    await prisma.adminSession.deleteMany({
      where: { adminId: targetId },
    });
  }

  if (targetType === "CUSTOMER") {
    await prisma.customer.update({
      where: { id: targetId },
      data: {
        status: "SUSPENDED",
      },
    });
  }

  await createIncidentIfNotExists({
    type: "FRAUD",
    referenceId: targetId,
  });

  await logAudit({
    userId: actor.id,
    entityType: "FRAUD_FLAG",
    entityId: flag.id,
    action: "USER_FLAGGED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return flag;
};

exports.flagTransaction = async (subscriptionPaymentId, reason) => {
  const existing = await prisma.fraudFlag.findFirst({
    where: {
      subscriptionPaymentId,
      status: "ACTIVE",
    },
  });

  if (existing) {
    throw new AppError("Transaction already flagged", 400);
  }

  const flag = await prisma.fraudFlag.create({
    data: {
      subscriptionPaymentId,
      entityType: "SUBSCRIPTION_PAYMENT",
      reason,
      status: "ACTIVE",
    },
  });

  // 🔥 ENFORCEMENT (BLOCK PAYMENT)
  await prisma.subscriptionPayment.update({
    where: { id: subscriptionPaymentId },
    data: {
      status: "FAILED",
      flagged: true,
    },
  });

  await createIncidentIfNotExists({
    type: "FRAUD",
    referenceId: subscriptionPaymentId,
  });

  await logAudit({
    userId: null,
    entityType: "FRAUD_FLAG",
    entityId: flag.id,
    action: "TRANSACTION_FLAGGED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return flag;
};

exports.resolveFlag = async (flagId, actor) => {
  const flag = await prisma.fraudFlag.findUnique({
    where: { id: flagId },
  });

  if (!flag) {
    throw new AppError("Flag not found", 404);
  }

  const result = await prisma.fraudFlag.update({
    where: { id: flagId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  // 🔄 REVERSAL LOGIC

  if (flag.entityType === "USER" && flag.userId) {
    await prisma.user.update({
      where: { id: flag.userId },
      data: {
        status: "ACTIVE",
        tokenVersion: { increment: 1 },
      },
    });
  }

  if (flag.entityType === "ADMIN" && flag.adminId) {
    await prisma.systemAdmin.update({
      where: { id: flag.adminId },
      data: {
        status: "ACTIVE",
      },
    });
  }

  if (flag.entityType === "CUSTOMER" && flag.customerId) {
    await prisma.customer.update({
      where: { id: flag.customerId },
      data: {
        status: "ACTIVE",
      },
    });
  }

  if (
    flag.entityType === "SUBSCRIPTION_PAYMENT" &&
    flag.subscriptionPaymentId
  ) {
    await prisma.subscriptionPayment.update({
      where: { id: flag.subscriptionPaymentId },
      data: {
        status: "CONFIRMED",
      },
    });
  }

  await logAudit({
    userId: actor.id,
    entityType: "FRAUD_FLAG",
    entityId: flagId,
    action: "FRAUD_FLAG_RESOLVED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};

exports.getFlags = async (query) => {
  const { skip, take } = getPagination(query);

  return prisma.fraudFlag.findMany({
    where: {
      ...(query.status && { status: query.status }),
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * =====================================================
 * SUSPICIOUS TRANSACTIONS
 * =====================================================
 */

exports.getSuspiciousTransactions = async (options = {}) => {
  const { amountThreshold = 1000000, retryThreshold = 3, limit = 50 } = options;

  const transactions = await prisma.subscriptionPayment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const suspicious = [];

  for (const tx of transactions) {
    let riskScore = 0;
    const reasons = [];

    // 🔍 RULE 1 — HIGH AMOUNT
    if (tx.amount > amountThreshold) {
      riskScore += 40;
      reasons.push("HIGH_AMOUNT");
    }

    // 🔍 RULE 2 — MANY RETRIES
    if (tx.retryCount > retryThreshold) {
      riskScore += 30;
      reasons.push("HIGH_RETRY");
    }

    // 🔍 RULE 3 — FAILED STATUS
    if (tx.status === "FAILED") {
      riskScore += 20;
      reasons.push("FAILED_PAYMENT");
    }

    // 🔍 RULE 4 — RAPID TRANSACTIONS (SAME USER)
    const recentCount = await prisma.subscriptionPayment.count({
      where: {
        subscriptionId: tx.subscriptionId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // last 5 mins
        },
      },
    });

    if (recentCount > 5) {
      riskScore += 30;
      reasons.push("RAPID_ACTIVITY");
    }

    // 🎯 FINAL DECISION
    if (riskScore >= 40) {
      // 🔥 CREATE INCIDENT (ONLY HIGH RISK)
      if (riskScore >= 70) {
        const existingIncident = await prisma.securityIncident.findFirst({
          where: {
            referenceId: tx.id,
            type: "SUSPICIOUS_TRANSACTION",
            status: "OPEN",
          },
        });

        if (!existingIncident) {
          await createSecurityIncident({
            type: "SUSPICIOUS_TRANSACTION",
            title: "Suspicious transaction detected",
            description: `Transaction ${tx.id} flagged with risk score ${riskScore}`,
            severity: riskScore >= 90 ? "CRITICAL" : "HIGH",
            source: "DETECTION_ENGINE",
            referenceId: tx.id,
            metadata: {
              riskScore,
              reasons,
              amount: tx.amount,
              retryCount: tx.retryCount,
              status: tx.status,
            },
          });
        }
      }

      suspicious.push({
        ...tx,
        riskScore,
        reasons,
      });
    }
  }

  return suspicious;
};

/**
 * =====================================================
 * LOGIN ANOMALY DETECTION
 * =====================================================
 */
exports.detectLoginAnomaly = async (userId) => {
  // Last 10 login attempts
  const recentLogins = await prisma.loginActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const failedAttempts = recentLogins.filter(
    (l) => l.status === "FAILED",
  ).length;

  // Rule: more than 5 failed attempts
  if (failedAttempts >= 5) {
    await createIncidentIfNotExists({
      type: "LOGIN_ANOMALY",
      title: "Multiple failed login attempts",
      description: `User ${userId} has ${failedAttempts} failed login attempts`,
      severity: "HIGH",
      source: "AUTH",
      referenceId: userId,
    });
  }

  return true;
};

/**
 * =====================================================
 * SYSTEM ERROR LOGGING
 * =====================================================
 */

const generateSignature = (message, stack) => {
  return crypto
    .createHash("sha256")
    .update(message + (stack || ""))
    .digest("hex");
};

exports.logSystemError = async (error) => {
  const signature = generateSignature(error.message, error.stack);

  let group = await prisma.systemErrorGroup.findUnique({
    where: { signature },
  });

  if (!group) {
    group = await prisma.systemErrorGroup.create({
      data: {
        signature,
        message: error.message,
        occurrence: 1,
      },
    });
  } else {
    await prisma.systemErrorGroup.update({
      where: { id: group.id },
      data: {
        occurrence: { increment: 1 },
      },
    });
  }

  const result = await prisma.systemError.create({
    data: {
      groupId: group.id,
      stack: error.stack,
      environment: env.NODE_ENV || "development",
    },
  });

  await logAudit({
    userId: null,
    entityType: "SYSTEM_ERROR",
    entityId: result.id,
    action: "SYSTEM_ERROR_LOGGED",
    module: "SECURITY",
    actorType: "SYSTEM",
  });

  return result;
};

/**
 * =====================================================
 * FORCE LOGOUT
 * =====================================================
 */

exports.forceLogoutUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("auth.user_not_found", 404);
  }

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    userId: userId,
    entityType: "USER",
    entityId: userId,
    action: "USER_FORCE_LOGOUT",
    module: "SECURITY",
    actorType: "ADMIN",
  });
  return true;
};

/**
 * =====================================================
 * SECURITY OVERVIEW (AGGREGATED RISKS)
 * =====================================================
 */

exports.getSecurityOverview = async () => {
  const [fraudFlags, suspiciousTransactions, integrityIssues] =
    await Promise.all([
      prisma.fraudFlag.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      prisma.subscriptionPayment.findMany({
        where: {
          OR: [
            { status: "FAILED" },
            { flagged: true },
            { retryCount: { gt: 3 } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      exports.runIntegrityChecks(),
    ]);

  return {
    fraudFlags,
    suspiciousTransactions,
    integrityIssues,
  };
};

/**
 * =====================================================
 * INCIDENT DEDUPLICATION HELPER
 * =====================================================
 */

const createIncidentIfNotExists = async ({
  type,
  title,
  description,
  severity,
  source,
  referenceId,
  metadata = null,
}) => {
  const existing = await prisma.securityIncident.findFirst({
    where: {
      type,
      referenceId,
      status: {
        in: ["OPEN", "IN_PROGRESS"],
      },
    },
  });

  if (existing) return null;

  return prisma.securityIncident.create({
    data: {
      type,
      title,
      description,
      severity,
      status: "OPEN",
      source,
      referenceId,
      metadata,
    },
  });
};

exports.runIntegrityChecks = async () => {
  const issues = [];

  const contracts = await prisma.contract.findMany({
    select: {
      id: true,
      totalValue: true,
      paidAmount: true,
      outstandingAmount: true,
    },
  });

  for (const contract of contracts) {
    // Overpaid contract
    if (contract.paidAmount > contract.totalValue) {
      issues.push({
        type: "overpaid_contract",
        contractId: contract.id,
      });

      await createIncidentIfNotExists({
        type: "SYSTEM_INTEGRITY",
        title: "Contract overpaid",
        description: `Contract ${contract.id} is overpaid`,
        severity: "MEDIUM",
        source: "SYSTEM",
        referenceId: contract.id,
      });
    }

    // Negative outstanding
    if (contract.outstandingAmount < 0) {
      issues.push({
        type: "negative_outstanding",
        contractId: contract.id,
      });

      await handleSecurityEvent({
        type: "SUSPICIOUS_TRANSACTION",
        title: "Suspicious transaction detected",
        description: `Transaction ${tx.id} risk ${riskScore}`,
        referenceId: tx.id,
        source: "DETECTION_ENGINE",
        riskScore,
        metadata: {
          reasons,
          amount: tx.amount,
          retryCount: tx.retryCount,
          status: tx.status,
        },
      });
    }
  }

  return issues;
};

/**
 * =====================================================
 * SECURITY INCIDENT MANAGEMENT
 * =====================================================
 */

/**
 * CREATE INCIDENT (CORE ENGINE)
 */
exports.createSecurityIncident = async ({
  type,
  title,
  description,
  severity = "MEDIUM",
  source,
  referenceId = null,
  metadata = null,
}) => {
  const result = await prisma.securityIncident.create({
    data: {
      type,
      title,
      description,
      severity,
      status: "OPEN",
      source,
      referenceId,
      metadata,
    },
  });

  await logAudit({
    userId: null,
    entityType: "SECURITY_INCIDENT",
    entityId: result.id,
    action: "SECURITY_INCIDENT_CREATED",
    module: "SECURITY",
    actorType: "SYSTEM",
  });

  return result;
};

/**
 * GET INCIDENTS
 */
exports.getSecurityIncidents = async (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  return prisma.securityIncident.findMany({
    where: {
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.severity && { severity: query.severity }),
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * GET INCIDENT BY ID
 */
exports.getSecurityIncidentById = async (id) => {
  const incident = await prisma.securityIncident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError("security.incident_not_found", 404);
  }

  return incident;
};

/**
 * UPDATE INCIDENT STATUS
 */
exports.updateSecurityIncidentStatus = async (id, status) => {
  const incident = await prisma.securityIncident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError("security.incident_not_found", 404);
  }

  const allowedTransitions = {
    OPEN: ["IN_PROGRESS", "RESOLVED"],
    IN_PROGRESS: ["RESOLVED"],
    RESOLVED: [],
  };

  if (!allowedTransitions[incident.status].includes(status)) {
    throw new AppError("security.invalid_status_transition", 400);
  }

  const result = await prisma.securityIncident.update({
    where: { id },
    data: { status },
  });

  await logAudit({
    userId: null,
    entityType: "SECURITY_INCIDENT",
    entityId: id,
    action: "SECURITY_INCIDENT_STATUS_UPDATED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};
