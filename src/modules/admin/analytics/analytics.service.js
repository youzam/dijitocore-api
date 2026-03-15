const prisma = require("../../../config/prisma");

// =============================
// CACHE (TTL: 60s)
// =============================
const cache = new Map();

const getCache = (key) => cache.get(key);

const setCache = (key, value) => {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), 60000);
};

// =============================
// HELPERS
// =============================
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};

  return {
    createdAt: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    },
  };
};

const diffDays = (a, b) => {
  return Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
};

// =============================
// DASHBOARD SUMMARY (FULL)
// =============================
exports.getDashboardSummary = async (query) => {
  const { startDate, endDate } = query;
  const cacheKey = `dashboard_full:${startDate || ""}:${endDate || ""}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const dateFilter = buildDateFilter(startDate, endDate);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  // previous period (for growth)
  let prevStart = null;
  let prevEnd = null;

  if (start && end) {
    const days = diffDays(start, end);
    prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    prevEnd = new Date(start);
  }

  const [
    // subscriptions
    activeSubsAgg,
    totalSubs,
    cancelledSubs,
    trialSubs,
    expiredSubs,

    // revenue
    revenueAgg,
    prevRevenueAgg,

    // businesses
    totalBusinesses,
    activeBusinesses,

    // upgrades
    upgradesCount,

    // advanced metrics
    renewalCount,
    expansionData,
    convertedCount,
    trialCount, // 🔥 added
  ] = await Promise.all([
    prisma.subscription.aggregate({
      _sum: { price: true },
      where: { status: "ACTIVE" },
    }),

    prisma.subscription.count(),

    prisma.subscription.count({
      where: { status: "CANCELLED" },
    }),

    prisma.subscription.count({
      where: { status: "TRIAL" },
    }),

    prisma.subscription.count({
      where: { status: "EXPIRED" },
    }),

    // ✅ REAL REVENUE
    prisma.subscriptionPayment.aggregate({
      _sum: { amount: true },
      where: {
        status: "SUCCESS",
        ...dateFilter,
      },
    }),

    // ✅ PREVIOUS REVENUE
    prevStart && prevEnd
      ? prisma.subscriptionPayment.aggregate({
          _sum: { amount: true },
          where: {
            status: "SUCCESS",
            createdAt: { gte: prevStart, lte: prevEnd },
          },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),

    prisma.business.count(),

    prisma.business.count({
      where: { status: "ACTIVE" },
    }),

    prisma.subscription.count({
      where: { isUpgrade: true },
    }),

    // renewal
    prisma.subscriptionPayment.count({
      where: {
        status: "SUCCESS",
        type: "RENEWAL",
      },
    }),

    // expansion
    prisma.subscriptionHistory.findMany({
      where: { changeType: "UPGRADE" },
      select: { oldPrice: true, newPrice: true },
    }),

    // conversions
    prisma.subscription.count({
      where: {
        convertedAt: { not: null },
      },
    }),

    // 🔥 REAL trial count
    prisma.subscription.count({
      where: {
        isTrial: true,
      },
    }),
  ]);

  // =============================
  // CORE METRICS
  // =============================
  const mrr = activeSubsAgg._sum.price || 0;
  const arr = mrr * 12;

  const totalRevenue = revenueAgg._sum.amount || 0;
  const prevRevenue = prevRevenueAgg._sum.amount || 0;

  const revenueGrowth = prevRevenue
    ? (totalRevenue - prevRevenue) / prevRevenue
    : 0;

  const churnRate = totalSubs ? cancelledSubs / totalSubs : 0;

  const conversionRate = trialSubs ? (totalSubs - trialSubs) / trialSubs : 0;

  const realConversionRate = trialCount ? convertedCount / trialCount : 0;

  const arpu = activeBusinesses ? totalRevenue / activeBusinesses : 0;

  // =============================
  // ADVANCED METRICS
  // =============================
  const avgSubscriptionValue = totalSubs ? totalRevenue / totalSubs : 0;

  const failureRate = totalSubs ? expiredSubs / totalSubs : 0;

  const upgradeRate = totalSubs ? upgradesCount / totalSubs : 0;

  const retentionRate = totalSubs ? (totalSubs - cancelledSubs) / totalSubs : 0;

  // ✅ FIXED (REAL)
  const trialDropOffRate = trialCount
    ? (trialCount - convertedCount) / trialCount
    : 0;

  const renewalRate = totalSubs ? renewalCount / totalSubs : 0;

  const expansionRevenue = expansionData.reduce((sum, item) => {
    return sum + ((item.newPrice || 0) - (item.oldPrice || 0));
  }, 0);

  // =============================
  // TENANT HEALTH
  // =============================
  const healthScore = totalBusinesses
    ? (activeBusinesses - expiredSubs) / totalBusinesses
    : 0;

  const result = {
    // core
    mrr,
    arr,
    totalRevenue,
    revenueGrowth,
    churnRate,
    conversionRate,
    realConversionRate,
    arpu,

    // advanced
    avgSubscriptionValue,
    retentionRate,
    failureRate,
    upgradeRate,
    trialDropOffRate,
    renewalRate,
    expansionRevenue,

    // counts
    totalSubscriptions: totalSubs,
    activeBusinesses,
    totalBusinesses,

    // health
    healthScore,
  };

  setCache(cacheKey, result);

  return result;
};

// =============================
// REVENUE TRENDS
// =============================
exports.getRevenueTrends = async (query) => {
  const { startDate, endDate } = query;
  const cacheKey = `revenue_trends:${startDate || ""}:${endDate || ""}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const dateFilter = buildDateFilter(startDate, endDate);

  const data = await prisma.subscriptionPayment.groupBy({
    by: ["createdAt"],
    where: {
      status: "SUCCESS",
      ...dateFilter,
    },
    _sum: { amount: true },
  });

  const result = data.map((item) => ({
    date: item.createdAt,
    revenue: item._sum.amount || 0,
  }));

  setCache(cacheKey, result);
  return result;
};

// =============================
// REVENUE GROWTH %
// =============================
exports.getRevenueGrowth = async (query) => {
  const { startDate, endDate } = query;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const days = diffDays(start, end);

  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);

  const prevEnd = new Date(start);

  const [current, previous] = await Promise.all([
    prisma.subscription.aggregate({
      _sum: { price: true },
      where: {
        createdAt: { gte: start, lte: end },
      },
    }),
    prisma.subscription.aggregate({
      _sum: { price: true },
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
  ]);

  const currentVal = current._sum.price || 0;
  const prevVal = previous._sum.price || 0;

  const growth = prevVal ? (currentVal - prevVal) / prevVal : 0;

  return { growth };
};

// =============================
// REVENUE BY PACKAGE
// =============================
exports.getRevenueByPackage = async () => {
  const data = await prisma.subscription.groupBy({
    by: ["packageId"],
    _sum: { price: true },
  });

  return data.map((item) => ({
    packageId: item.packageId,
    revenue: item._sum.price || 0,
  }));
};

// =============================
// REVENUE BY COUNTRY
// =============================
exports.getRevenueByCountry = async () => {
  const subs = await prisma.subscription.findMany({
    select: {
      price: true,
      business: { select: { country: true } },
    },
  });

  const grouped = {};

  for (const sub of subs) {
    const c = sub.business?.country || "UNKNOWN";
    grouped[c] = (grouped[c] || 0) + sub.price;
  }

  return Object.entries(grouped).map(([country, revenue]) => ({
    country,
    revenue,
  }));
};

// =============================
// BUSINESS GROWTH
// =============================
exports.getBusinessGrowth = async (query) => {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const data = await prisma.business.groupBy({
    by: ["createdAt"],
    where: dateFilter,
    _count: { id: true },
  });

  return data.map((d) => ({
    date: d.createdAt,
    count: d._count.id,
  }));
};

// =============================
// USER GROWTH
// =============================
exports.getUserGrowth = async (query) => {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const data = await prisma.user.groupBy({
    by: ["createdAt"],
    where: dateFilter,
    _count: { id: true },
  });

  return data.map((d) => ({
    date: d.createdAt,
    count: d._count.id,
  }));
};

// =============================
// SUBSCRIPTION METRICS (FULL)
// =============================
exports.getSubscriptionMetrics = async () => {
  const [total, active, cancelled, trial, expired] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "CANCELLED" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
  ]);

  const conversionRate = trial ? active / trial : 0;
  const churnRate = total ? cancelled / total : 0;
  const failureRate = total ? expired / total : 0;

  return {
    total,
    active,
    cancelled,
    trial,
    expired,
    conversionRate,
    churnRate,
    failureRate,
  };
};

// =============================
// UPGRADE SIGNALS
// =============================
exports.getUpgradeSignals = async () => {
  const upgrades = await prisma.subscription.count({
    where: {
      isUpgrade: true,
    },
  });

  const total = await prisma.subscription.count();

  const upgradeRate = total ? upgrades / total : 0;

  return { upgrades, upgradeRate };
};

// =============================
// COHORT ANALYSIS (RETENTION)
// =============================
exports.getCohortAnalysis = async () => {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      createdAt: true,
    },
  });

  const cohorts = {};

  for (const b of businesses) {
    const month = b.createdAt.toISOString().slice(0, 7);
    cohorts[month] = (cohorts[month] || 0) + 1;
  }

  return Object.entries(cohorts).map(([month, count]) => ({
    month,
    count,
  }));
};

// =============================
// TENANT HEALTH (ADVANCED)
// =============================
exports.getTenantHealth = async () => {
  const [totalBusinesses, activeSubs, expiredSubs] = await Promise.all([
    prisma.business.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
  ]);

  const healthScore = totalBusinesses
    ? (activeSubs - expiredSubs) / totalBusinesses
    : 0;

  return {
    totalBusinesses,
    activeSubscriptions: activeSubs,
    expiredSubscriptions: expiredSubs,
    healthScore,
  };
};

// =============================
// COHORT RETENTION (REAL)
// =============================
exports.getCohortRetention = async () => {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  const cohorts = {};

  for (const b of businesses) {
    const cohort = b.createdAt.toISOString().slice(0, 7);

    if (!cohorts[cohort]) {
      cohorts[cohort] = {
        total: 0,
        active: 0,
      };
    }

    cohorts[cohort].total++;

    if (b.lastActiveAt) {
      cohorts[cohort].active++;
    }
  }

  return Object.entries(cohorts).map(([month, data]) => ({
    month,
    total: data.total,
    active: data.active,
    retentionRate: data.total ? data.active / data.total : 0,
  }));
};

// =============================
// USAGE ANALYTICS
// =============================
exports.getUsageAnalytics = async () => {
  const usage = await prisma.subscriptionUsage.groupBy({
    by: ["feature"],
    _sum: { used: true },
  });

  return usage.map((u) => ({
    feature: u.feature,
    usage: u._sum.used || 0,
  }));
};

// =============================
// EXPANSION REVENUE
// =============================
exports.getExpansionRevenue = async () => {
  const data = await prisma.subscriptionHistory.findMany({
    where: { changeType: "UPGRADE" },
    select: {
      oldPrice: true,
      newPrice: true,
    },
  });

  const total = data.reduce((sum, item) => {
    return sum + ((item.newPrice || 0) - (item.oldPrice || 0));
  }, 0);

  return { expansionRevenue: total };
};

// =============================
// RENEWAL RATE
// =============================
exports.getRenewalRate = async () => {
  const [renewals, total] = await Promise.all([
    prisma.subscriptionPayment.count({
      where: {
        status: "SUCCESS",
        type: "RENEWAL",
      },
    }),
    prisma.subscription.count(),
  ]);

  return {
    renewalRate: total ? renewals / total : 0,
  };
};

// =============================
// REAL CONVERSION RATE
// =============================
exports.getConversionRate = async () => {
  const [trial, converted] = await Promise.all([
    prisma.subscription.count({
      where: { isTrial: true },
    }),
    prisma.subscription.count({
      where: { convertedAt: { not: null } },
    }),
  ]);

  return {
    conversionRate: trial ? converted / trial : 0,
  };
};

// =============================
// CHURN RATE (IMPROVED)
// =============================
exports.getChurnRate = async (query) => {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const [cancelled, total] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: "CANCELLED",
        ...dateFilter,
      },
    }),
    prisma.subscription.count(),
  ]);

  return {
    churnRate: total ? cancelled / total : 0,
  };
};

// =============================
// TENANT HEALTH (ADVANCED)
// =============================
exports.getTenantHealthAdvanced = async () => {
  const [businesses, activeSubs, expiredSubs, usage] = await Promise.all([
    prisma.business.findMany({
      select: {
        id: true,
        lastActiveAt: true,
      },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
    prisma.subscriptionUsage.aggregate({
      _sum: { used: true },
    }),
  ]);

  const activeBusinesses = businesses.filter((b) => b.lastActiveAt).length;

  const usageScore = usage._sum.used || 0;

  const healthScore =
    businesses.length > 0
      ? (activeBusinesses + activeSubs - expiredSubs + usageScore) /
        businesses.length
      : 0;

  return {
    totalBusinesses: businesses.length,
    activeBusinesses,
    activeSubscriptions: activeSubs,
    expiredSubscriptions: expiredSubs,
    usageScore,
    healthScore,
  };
};
