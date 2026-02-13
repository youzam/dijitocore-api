const prisma = require("../../config/prisma");

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
