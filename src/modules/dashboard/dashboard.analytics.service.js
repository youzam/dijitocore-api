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
