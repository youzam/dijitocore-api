const crypto = require("crypto");
const AppError = require("../../../utils/AppError");
const prisma = require("../../../config/prisma");

exports.createIncident = async (data, userId) => {
  return prisma.supportIncident.create({
    data: {
      title: data.title,
      description: data.description,
      severity: data.severity,
      createdBy: userId,
    },
  });
};

exports.updateIncident = async (id, data) => {
  const incident = await prisma.supportIncident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError("incident.notFound", 404);
  }

  return prisma.supportIncident.update({
    where: { id },
    data,
  });
};

exports.runIntegrityChecks = async () => {
  const issues = [];

  /**
   * =========================================
   * 1️⃣ Referential Integrity - Payments
   * =========================================
   */

  const payments = await prisma.payment.findMany({
    select: { id: true, contractId: true },
  });

  const contracts = await prisma.contract.findMany({
    select: {
      id: true,
      totalValue: true,
      paidAmount: true,
      outstandingAmount: true,
    },
  });

  const contractMap = new Map(contracts.map((c) => [c.id, c]));

  const orphanPayments = payments.filter((p) => !contractMap.has(p.contractId));

  if (orphanPayments.length > 0) {
    issues.push({
      type: "orphan_payments",
      count: orphanPayments.length,
    });
  }

  /**
   * =========================================
   * 2️⃣ Overpaid Contracts (Using totalValue)
   * =========================================
   */

  contracts.forEach((contract) => {
    if (contract.paidAmount > contract.totalValue) {
      issues.push({
        type: "overpaid_contract",
        contractId: contract.id,
        paidAmount: contract.paidAmount,
        totalValue: contract.totalValue,
      });
    }

    if (contract.outstandingAmount < 0) {
      issues.push({
        type: "negative_outstanding",
        contractId: contract.id,
        outstandingAmount: contract.outstandingAmount,
      });
    }
  });

  /**
   * =========================================
   * 3️⃣ Schedule vs Contract Total Mismatch
   * =========================================
   */

  const scheduleAgg = await prisma.installmentSchedule.groupBy({
    by: ["contractId"],
    _sum: { amount: true },
  });

  scheduleAgg.forEach((s) => {
    const contract = contractMap.get(s.contractId);
    if (!contract) return;

    const totalScheduled = s._sum.amount || 0;

    if (totalScheduled !== contract.totalValue) {
      issues.push({
        type: "schedule_mismatch",
        contractId: s.contractId,
        scheduledTotal: totalScheduled,
        contractTotal: contract.totalValue,
      });
    }
  });

  return issues;
};

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

  return prisma.systemError.create({
    data: {
      groupId: group.id,
      stack: error.stack,
      environment: process.env.NODE_ENV || "development",
    },
  });
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
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return true;
};
