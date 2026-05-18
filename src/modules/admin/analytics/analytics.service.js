const prisma = require('../../../config/prisma');

// =============================
// CACHE (TTL: 60s)
// =============================
const cache = new Map();

const getCache = (key) => cache.get(key);

const setCache = (key, value) => {
  cache.set(key, value);

  setTimeout(() => {
    cache.delete(key);
  }, 60000);
};

// =============================
// HELPERS
// =============================
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return {};
  }

  return {
    createdAt: {
      ...(startDate && {
        gte: new Date(startDate),
      }),

      ...(endDate && {
        lte: new Date(endDate),
      }),
    },
  };
};

const diffDays = (a, b) => {
  return Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
};

const getSubscriptionValue = (subscription) => {
  if (subscription.billingCycle === 'YEARLY') {
    return subscription.priceYearlySnapshot || 0;
  }

  return subscription.priceMonthlySnapshot || 0;
};

// =============================
// DASHBOARD SUMMARY
// =============================
exports.getDashboardSummary = async (query) => {
  const { startDate, endDate } = query;

  const cacheKey = `dashboard_full:${startDate || ''}:${endDate || ''}`;

  const cached = getCache(cacheKey);

  if (cached) {
    return cached;
  }

  const dateFilter = buildDateFilter(startDate, endDate);

  const start = startDate ? new Date(startDate) : null;

  const end = endDate ? new Date(endDate) : null;

  let prevStart = null;
  let prevEnd = null;

  if (start && end) {
    const days = diffDays(start, end);

    prevStart = new Date(start);

    prevStart.setDate(prevStart.getDate() - days);

    prevEnd = new Date(start);
  }

  const [
    activeSubscriptions,
    totalSubs,
    cancelledSubs,
    expiredSubs,

    revenueAgg,
    prevRevenueAgg,

    totalBusinesses,
    activeBusinesses,

    upgradesCount,

    renewalCount,

    expansionData,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },

      select: {
        billingCycle: true,
        priceMonthlySnapshot: true,
        priceYearlySnapshot: true,
      },
    }),

    prisma.subscription.count(),

    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'EXPIRED',
      },
    }),

    prisma.subscriptionPayment.aggregate({
      _sum: {
        amount: true,
      },

      where: {
        status: 'SUCCESS',
        ...dateFilter,
      },
    }),

    prevStart && prevEnd
      ? prisma.subscriptionPayment.aggregate({
          _sum: {
            amount: true,
          },

          where: {
            status: 'SUCCESS',

            createdAt: {
              gte: prevStart,
              lte: prevEnd,
            },
          },
        })
      : Promise.resolve({
          _sum: {
            amount: 0,
          },
        }),

    prisma.business.count(),

    prisma.business.count({
      where: {
        status: 'ACTIVE',
      },
    }),

    prisma.subscriptionHistory.count({
      where: {
        changeType: 'UPGRADE',
      },
    }),

    prisma.subscriptionPayment.count({
      where: {
        status: 'SUCCESS',
        type: 'RENEWAL',
      },
    }),

    prisma.subscriptionHistory.findMany({
      where: {
        changeType: 'UPGRADE',
      },

      select: {
        oldPrice: true,
        newPrice: true,
      },
    }),
  ]);

  const mrr = activeSubscriptions.reduce((sum, subscription) => {
    return sum + getSubscriptionValue(subscription);
  }, 0);

  const arr = mrr * 12;

  const totalRevenue = revenueAgg._sum.amount || 0;

  const prevRevenue = prevRevenueAgg._sum.amount || 0;

  const revenueGrowth = prevRevenue
    ? (totalRevenue - prevRevenue) / prevRevenue
    : 0;

  const churnRate = totalSubs ? cancelledSubs / totalSubs : 0;

  const arpu = activeBusinesses ? totalRevenue / activeBusinesses : 0;

  const avgSubscriptionValue = totalSubs ? totalRevenue / totalSubs : 0;

  const failureRate = totalSubs ? expiredSubs / totalSubs : 0;

  const upgradeRate = totalSubs ? upgradesCount / totalSubs : 0;

  const retentionRate = totalSubs ? (totalSubs - cancelledSubs) / totalSubs : 0;

  const renewalRate = totalSubs ? renewalCount / totalSubs : 0;

  const expansionRevenue = expansionData.reduce((sum, item) => {
    return sum + ((item.newPrice || 0) - (item.oldPrice || 0));
  }, 0);

  const healthScore = totalBusinesses
    ? (activeBusinesses - expiredSubs) / totalBusinesses
    : 0;

  const result = {
    mrr,

    arr,

    totalRevenue,

    revenueGrowth,

    churnRate,

    arpu,

    avgSubscriptionValue,

    retentionRate,

    failureRate,

    upgradeRate,

    renewalRate,

    expansionRevenue,

    totalSubscriptions: totalSubs,

    activeBusinesses,

    totalBusinesses,

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

  const cacheKey = `revenue_trends:${startDate || ''}:${endDate || ''}`;

  const cached = getCache(cacheKey);

  if (cached) {
    return cached;
  }

  const dateFilter = buildDateFilter(startDate, endDate);

  const data = await prisma.subscriptionPayment.groupBy({
    by: ['createdAt'],

    where: {
      status: 'SUCCESS',
      ...dateFilter,
    },

    _sum: {
      amount: true,
    },
  });

  const result = data.map((item) => ({
    date: item.createdAt,
    revenue: item._sum.amount || 0,
  }));

  setCache(cacheKey, result);

  return result;
};

// =============================
// REVENUE GROWTH
// =============================
exports.getRevenueGrowth = async (query) => {
  const start = new Date(query.startDate);

  const end = new Date(query.endDate);

  const days = diffDays(start, end);

  const prevStart = new Date(start);

  prevStart.setDate(prevStart.getDate() - days);

  const prevEnd = new Date(start);

  const [current, previous] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },

      select: {
        billingCycle: true,
        priceMonthlySnapshot: true,
        priceYearlySnapshot: true,
      },
    }),

    prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: prevStart,
          lte: prevEnd,
        },
      },

      select: {
        billingCycle: true,
        priceMonthlySnapshot: true,
        priceYearlySnapshot: true,
      },
    }),
  ]);

  const currentVal = current.reduce((sum, subscription) => {
    return sum + getSubscriptionValue(subscription);
  }, 0);

  const prevVal = previous.reduce((sum, subscription) => {
    return sum + getSubscriptionValue(subscription);
  }, 0);

  const growth = prevVal ? (currentVal - prevVal) / prevVal : 0;

  return { growth };
};

// =============================
// REVENUE BY PACKAGE
// =============================
exports.getRevenueByPackage = async () => {
  const data = await prisma.subscription.findMany({
    select: {
      packageId: true,
      billingCycle: true,
      priceMonthlySnapshot: true,
      priceYearlySnapshot: true,
    },
  });

  const grouped = {};

  for (const item of data) {
    if (!grouped[item.packageId]) {
      grouped[item.packageId] = 0;
    }

    grouped[item.packageId] += getSubscriptionValue(item);
  }

  return Object.entries(grouped).map(([packageId, revenue]) => ({
    packageId,
    revenue,
  }));
};

// =============================
// REVENUE BY COUNTRY
// =============================
exports.getRevenueByCountry = async () => {
  const subs = await prisma.subscription.findMany({
    select: {
      billingCycle: true,

      priceMonthlySnapshot: true,

      priceYearlySnapshot: true,

      business: {
        select: {
          country: true,
        },
      },
    },
  });

  const grouped = {};

  for (const sub of subs) {
    const country = sub.business?.country || 'UNKNOWN';

    if (!grouped[country]) {
      grouped[country] = 0;
    }

    grouped[country] += getSubscriptionValue(sub);
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
    by: ['createdAt'],

    where: dateFilter,

    _count: {
      id: true,
    },
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
    by: ['createdAt'],

    where: dateFilter,

    _count: {
      id: true,
    },
  });

  return data.map((d) => ({
    date: d.createdAt,
    count: d._count.id,
  }));
};

// =============================
// SUBSCRIPTION METRICS
// =============================
exports.getSubscriptionMetrics = async () => {
  const [total, active, cancelled, expired] = await Promise.all([
    prisma.subscription.count(),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'EXPIRED',
      },
    }),
  ]);

  const churnRate = total ? cancelled / total : 0;

  const failureRate = total ? expired / total : 0;

  return {
    total,

    active,

    cancelled,

    expired,

    churnRate,

    failureRate,
  };
};

// =============================
// UPGRADE SIGNALS
// =============================
exports.getUpgradeSignals = async () => {
  const upgrades = await prisma.subscriptionHistory.count({
    where: {
      changeType: 'UPGRADE',
    },
  });

  const total = await prisma.subscription.count();

  const upgradeRate = total ? upgrades / total : 0;

  return {
    upgrades,
    upgradeRate,
  };
};

// =============================
// COHORT ANALYSIS
// =============================
exports.getCohortAnalysis = async () => {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      createdAt: true,
    },
  });

  const cohorts = {};

  for (const business of businesses) {
    const month = business.createdAt.toISOString().slice(0, 7);

    cohorts[month] = (cohorts[month] || 0) + 1;
  }

  return Object.entries(cohorts).map(([month, count]) => ({
    month,
    count,
  }));
};

// =============================
// TENANT HEALTH
// =============================
exports.getTenantHealth = async () => {
  const [totalBusinesses, activeSubs, expiredSubs] = await Promise.all([
    prisma.business.count(),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'EXPIRED',
      },
    }),
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
// COHORT RETENTION
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

  for (const business of businesses) {
    const cohort = business.createdAt.toISOString().slice(0, 7);

    if (!cohorts[cohort]) {
      cohorts[cohort] = {
        total: 0,
        active: 0,
      };
    }

    cohorts[cohort].total++;

    if (business.lastActiveAt) {
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
// EXPANSION REVENUE
// =============================
exports.getExpansionRevenue = async () => {
  const data = await prisma.subscriptionHistory.findMany({
    where: {
      changeType: 'UPGRADE',
    },

    select: {
      oldPrice: true,
      newPrice: true,
    },
  });

  const total = data.reduce((sum, item) => {
    return sum + ((item.newPrice || 0) - (item.oldPrice || 0));
  }, 0);

  return {
    expansionRevenue: total,
  };
};

// =============================
// RENEWAL RATE
// =============================
exports.getRenewalRate = async () => {
  const [renewals, total] = await Promise.all([
    prisma.subscriptionPayment.count({
      where: {
        status: 'SUCCESS',

        type: 'RENEWAL',
      },
    }),

    prisma.subscription.count(),
  ]);

  return {
    renewalRate: total ? renewals / total : 0,
  };
};

// =============================
// CHURN RATE
// =============================
exports.getChurnRate = async (query) => {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const [cancelled, total] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
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
// TENANT HEALTH ADVANCED
// =============================
exports.getTenantHealthAdvanced = async () => {
  const [businesses, activeSubs, expiredSubs] = await Promise.all([
    prisma.business.findMany({
      select: {
        id: true,
        lastActiveAt: true,
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    }),

    prisma.subscription.count({
      where: {
        status: 'EXPIRED',
      },
    }),
  ]);

  const activeBusinesses = businesses.filter(
    (business) => business.lastActiveAt,
  ).length;

  const healthScore =
    businesses.length > 0
      ? (activeBusinesses + activeSubs - expiredSubs) / businesses.length
      : 0;

  return {
    totalBusinesses: businesses.length,

    activeBusinesses,

    activeSubscriptions: activeSubs,

    expiredSubscriptions: expiredSubs,

    healthScore,
  };
};
