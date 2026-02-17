const prisma = require("../../config/prisma");
const dayjs = require("dayjs");

/**
 * ===========================
 * SNAPSHOT DAILY SERIES
 * (Charts + Trends)
 * ===========================
 */
exports.getSnapshotSeries = async (businessId, days = 90) => {
  const from = dayjs().subtract(days, "day").startOf("day").toDate();

  return prisma.dashboardSnapshot.findMany({
    where: {
      businessId,
      snapshotDate: { gte: from },
    },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate: true,
      portfolio: true,
      collected: true,
      overdue: true,
    },
  });
};

/**
 * ===========================
 * BUSINESS HEALTH TIMELINE
 * ===========================
 */
exports.getHealthTimeline = async (businessId, days = 90) => {
  const from = dayjs().subtract(days, "day").startOf("day").toDate();

  const snapshots = await prisma.dashboardSnapshot.findMany({
    where: {
      businessId,
      snapshotDate: { gte: from },
    },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate: true,
      portfolio: true,
      overdue: true,
      collected: true,
    },
  });

  return snapshots.map((s) => {
    const total = (s.collected || 0) + (s.overdue || 0);
    const rate = total > 0 ? (s.collected / total) * 100 : 0;

    return {
      date: s.snapshotDate,
      healthScore: Number(rate.toFixed(2)),
    };
  });
};

/**
 * ===========================
 * SMART INSIGHTS
 * ===========================
 */
exports.generateInsights = async (businessId) => {
  const latest = await prisma.dashboardSnapshot.findMany({
    where: { businessId },
    orderBy: { snapshotDate: "desc" },
    take: 14,
  });

  if (latest.length < 14) return [];

  const recent = latest.slice(0, 7);
  const previous = latest.slice(7, 14);

  const sum = (arr, field) => arr.reduce((a, b) => a + (b[field] || 0), 0);

  const insights = [];

  const recentCollected = sum(recent, "collected");
  const prevCollected = sum(previous, "collected");

  if (prevCollected > 0) {
    const diff = ((recentCollected - prevCollected) / prevCollected) * 100;

    insights.push({
      type: "collections",
      message:
        diff >= 0
          ? `Collections increased by ${diff.toFixed(1)}%`
          : `Collections dropped by ${Math.abs(diff).toFixed(1)}%`,
    });
  }

  const recentOverdue = sum(recent, "overdue");
  const prevOverdue = sum(previous, "overdue");

  if (prevOverdue > 0) {
    const diff = ((recentOverdue - prevOverdue) / prevOverdue) * 100;

    insights.push({
      type: "overdue",
      message:
        diff >= 0
          ? `Overdue increased by ${diff.toFixed(1)}%`
          : `Overdue reduced by ${Math.abs(diff).toFixed(1)}%`,
    });
  }

  return insights;
};

/**
 * ===========================
 * COHORT ANALYSIS
 * ===========================
 */
exports.getCohorts = async (businessId) => {
  const thirtyDaysAgo = dayjs().subtract(30, "day").toDate();

  const newCustomers = await prisma.customer.count({
    where: {
      businessId,
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  const returningCustomers = await prisma.customer.count({
    where: {
      businessId,
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  const blacklisted = await prisma.customer.count({
    where: {
      businessId,
      isBlacklisted: true,
    },
  });

  const total = newCustomers + returningCustomers;

  return {
    newCustomers,
    returningCustomers,
    blacklistRatio:
      total > 0 ? Number(((blacklisted / total) * 100).toFixed(2)) : 0,
  };
};

/**
 * ===========================
 * FORWARD PROJECTIONS
 * ===========================
 */
exports.getProjections = async (businessId) => {
  const schedules = await prisma.installmentSchedule.findMany({
    where: {
      status: { not: "PAID" },
      contract: { businessId },
    },
    select: {
      amount: true,
      dueDate: true,
    },
  });

  const buckets = {
    next30: 0,
    next60: 0,
    next90: 0,
  };

  const now = dayjs();

  schedules.forEach((s) => {
    const diff = dayjs(s.dueDate).diff(now, "day");

    if (diff <= 30) buckets.next30 += s.amount;
    else if (diff <= 60) buckets.next60 += s.amount;
    else if (diff <= 90) buckets.next90 += s.amount;
  });

  return buckets;
};

/**
 * ===========================
 * AUDIT DASHBOARD
 * ===========================
 */
exports.getAuditDashboard = async (businessId) => {
  return prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

/**
 * ===========================
 * ADVANCED PORTFOLIO METRICS
 * ===========================
 */
exports.getAdvancedPortfolioMetrics = async (businessId) => {
  // 🔒 Feature Gating
  await require("../subscription/subscription.authority.service").assertFeature(
    businessId,
    "allowAdvancedAnalytics",
  );

  const now = new Date();

  /* =========================
     ACTIVE CONTRACTS
  ========================= */
  const activeContracts = await prisma.contract.findMany({
    where: {
      businessId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      totalValue: true,
      paidAmount: true,
      outstandingAmount: true,
    },
  });

  const totalPortfolio = activeContracts.reduce(
    (sum, c) => sum + (c.totalValue || 0),
    0,
  );

  const totalPaid = activeContracts.reduce(
    (sum, c) => sum + (c.paidAmount || 0),
    0,
  );

  const totalOutstanding = activeContracts.reduce(
    (sum, c) => sum + (c.outstandingAmount || 0),
    0,
  );

  /* =========================
     OVERDUE SCHEDULES
  ========================= */
  const overdueSchedules = await prisma.installmentSchedule.findMany({
    where: {
      status: "DUE",
      dueDate: { lt: now },
      contract: {
        businessId,
        status: "ACTIVE",
      },
    },
    select: {
      amount: true,
      dueDate: true,
      contractId: true,
    },
  });

  const totalOverdue = overdueSchedules.reduce(
    (sum, s) => sum + (s.amount || 0),
    0,
  );

  const overdueContractsCount = new Set(
    overdueSchedules.map((s) => s.contractId),
  ).size;

  /* =========================
     DELINQUENCY + EFFICIENCY
  ========================= */
  const delinquencyRatio =
    totalOutstanding > 0
      ? Number(((totalOverdue / totalOutstanding) * 100).toFixed(2))
      : 0;

  const collectionEfficiency =
    totalPortfolio > 0
      ? Number(((totalPaid / totalPortfolio) * 100).toFixed(2))
      : 0;

  /* =========================
     OVERDUE AGING BUCKETS
  ========================= */
  const aging = {
    "0_30": 0,
    "31_60": 0,
    "61_90": 0,
    "90_plus": 0,
  };

  overdueSchedules.forEach((s) => {
    const days = (now - new Date(s.dueDate)) / (1000 * 60 * 60 * 24);

    if (days <= 30) aging["0_30"] += s.amount;
    else if (days <= 60) aging["31_60"] += s.amount;
    else if (days <= 90) aging["61_90"] += s.amount;
    else aging["90_plus"] += s.amount;
  });

  /* =========================
     MONTHLY CASHFLOW (LAST 6 MONTHS)
  ========================= */
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      receivedAt: { gte: sixMonthsAgo },
      status: "POSTED",
    },
    select: {
      amount: true,
      receivedAt: true,
    },
  });

  const monthlyCashflow = {};

  payments.forEach((p) => {
    const d = new Date(p.receivedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}`;

    if (!monthlyCashflow[key]) monthlyCashflow[key] = 0;
    monthlyCashflow[key] += p.amount;
  });

  return {
    totalPortfolio,
    totalPaid,
    totalOutstanding,
    totalOverdue,
    delinquencyRatio,
    collectionEfficiency,
    activeContractsCount: activeContracts.length,
    overdueContractsCount,
    overdueAging: aging,
    monthlyCashflow,
  };
};
