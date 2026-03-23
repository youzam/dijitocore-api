const crypto = require("crypto");
const AppError = require("../../../utils/AppError");
const prisma = require("../../../config/prisma");

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
  const result = await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

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
  const result = await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    userId: null,
    entityType: "SESSION",
    entityId: tokenId,
    action: "ADMIN_SESSION_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
};

exports.revokeAllAdminSessions = async (adminId) => {
  const result = await prisma.refreshToken.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    userId: adminId,
    entityType: "SESSION",
    entityId: adminId,
    action: "ALL_ADMIN_SESSIONS_REVOKED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
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

exports.flagUser = async (userId, reason) => {
  const existing = await prisma.fraudFlag.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
  });

  if (existing) {
    throw new AppError("security.fraud_already_flagged", 400);
  }

  const flag = await prisma.fraudFlag.create({
    data: {
      userId,
      reason,
      status: "ACTIVE",
    },
  });

  // 🔥 INCIDENT (DEDUPED)
  await createIncidentIfNotExists({
    type: "FRAUD",
    title: "User flagged for fraud",
    description: reason,
    severity: "HIGH",
    source: "FRAUD_FLAG",
    referenceId: userId,
  });

  await logAudit({
    userId: userId,
    entityType: "FRAUD_FLAG",
    entityId: flag.id,
    action: "USER_FLAGGED",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return flag;
};

exports.flagTransaction = async (transactionId, reason) => {
  const existing = await prisma.fraudFlag.findFirst({
    where: {
      transactionId,
      status: "ACTIVE",
    },
  });

  if (existing) {
    throw new AppError("security.transaction_already_flagged", 400);
  }

  const flag = await prisma.fraudFlag.create({
    data: {
      transactionId,
      reason,
      status: "ACTIVE",
    },
  });

  // 🔥 INCIDENT (DEDUPED)
  await createIncidentIfNotExists({
    type: "FRAUD",
    title: "Transaction flagged for fraud",
    description: reason,
    severity: "HIGH",
    source: "FRAUD_FLAG",
    referenceId: transactionId,
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

exports.resolveFlag = async (flagId) => {
  const result = await prisma.fraudFlag.update({
    where: { id: flagId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  await logAudit({
    userId: null,
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

exports.getSuspiciousTransactions = async (query) => {
  const { skip, take } = getPagination(query);

  const transactions = await prisma.payment.findMany({
    where: {
      OR: [{ status: "FAILED" }, { flagged: true }, { retryCount: { gt: 3 } }],
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });

  // 🔥 CREATE INCIDENTS (DEDUPED)
  for (const tx of transactions) {
    await createIncidentIfNotExists({
      type: "SUSPICIOUS_TRANSACTION",
      title: "Suspicious transaction detected",
      description: `Transaction ${tx.id} is suspicious`,
      severity: "HIGH",
      source: "PAYMENT",
      referenceId: tx.id,
    });
  }

  return transactions;
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

exports.markTransactionAsSafe = async (transactionId) => {
  const result = await prisma.payment.update({
    where: { id: transactionId },
    data: { flagged: false },
  });

  await logAudit({
    userId: null,
    entityType: "TRANSACTION",
    entityId: transactionId,
    action: "TRANSACTION_MARKED_SAFE",
    module: "SECURITY",
    actorType: "ADMIN",
  });

  return result;
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
      environment: process.env.NODE_ENV || "development",
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

      prisma.payment.findMany({
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

      await createIncidentIfNotExists({
        type: "SYSTEM_INTEGRITY",
        title: "Negative outstanding detected",
        description: `Contract ${contract.id} has negative outstanding`,
        severity: "MEDIUM",
        source: "SYSTEM",
        referenceId: contract.id,
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
