const prisma = require("../../config/prisma");
const dayjs = require("dayjs");
const redis = require("../../utils/redis");

/**
 * Redis cache helper
 */
const cache = async (key, ttl, resolver) => {
  // Redis disabled or unavailable → go straight to DB
  if (!redis) {
    return resolver();
  }

  const cachedValue = await redis.get(key);
  if (cachedValue) {
    return JSON.parse(cachedValue);
  }

  const fresh = await resolver();
  await redis.set(key, JSON.stringify(fresh), "EX", ttl);
  return fresh;
};

/**
 * ===========================
 * TIME INTELLIGENCE
 * ===========================
 */
exports.getTimeComparisons = async (businessId) => {
  const today = dayjs().startOf("day");
  const yesterday = today.subtract(1, "day");

  const weekStart = today.startOf("week");
  const lastWeekStart = weekStart.subtract(7, "day");

  const monthStart = today.startOf("month");
  const lastMonthStart = monthStart.subtract(1, "month");

  return cache(`dash:time:${businessId}`, 300, async () => {
    const currentDay = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: { gte: today.toDate() },
      },
      _sum: { amount: true },
    });

    const previousDay = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: {
          gte: yesterday.toDate(),
          lt: today.toDate(),
        },
      },
      _sum: { amount: true },
    });

    const thisWeek = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: { gte: weekStart.toDate() },
      },
      _sum: { amount: true },
    });

    const lastWeek = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: {
          gte: lastWeekStart.toDate(),
          lt: weekStart.toDate(),
        },
      },
      _sum: { amount: true },
    });

    const thisMonth = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: { gte: monthStart.toDate() },
      },
      _sum: { amount: true },
    });

    const lastMonth = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
        createdAt: {
          gte: lastMonthStart.toDate(),
          lt: monthStart.toDate(),
        },
      },
      _sum: { amount: true },
    });

    return {
      today: currentDay._sum.amount || 0,
      yesterday: previousDay._sum.amount || 0,
      thisWeek: thisWeek._sum.amount || 0,
      lastWeek: lastWeek._sum.amount || 0,
      thisMonth: thisMonth._sum.amount || 0,
      lastMonth: lastMonth._sum.amount || 0,
    };
  });
};

/**
 * ===========================
 * STAFF SEGMENTATION
 * ===========================
 */
exports.getStaffMetrics = async (businessId) => {
  return cache(`dash:staff:${businessId}`, 300, async () => {
    const staffs = await prisma.user.findMany({
      where: { businessId, role: "STAFF" },
      select: { id: true, email: true }, // FIX: User has no name
    });

    const result = [];

    for (const staff of staffs) {
      const collected = await prisma.payment.aggregate({
        where: {
          businessId,
          reversals: {
            none: {
              status: "APPROVED",
            },
          },
          contract: {
            customer: { assignedStaffId: staff.id },
          },
        },
        _sum: { amount: true },
      });

      const overdue = await prisma.installmentSchedule.aggregate({
        where: {
          contract: { businessId },
          dueDate: { lt: new Date() },
          status: { not: "PAID" },
          contract: {
            customer: { assignedStaffId: staff.id },
          },
        },
        _sum: { amount: true, amount: true },
      });

      const overdueAmount =
        (overdue._sum.amount || 0) - (overdue._sum.amount || 0);

      const collectedAmount = collected._sum.amount || 0;

      const efficiency =
        collectedAmount + overdueAmount > 0
          ? Number(
              (
                (collectedAmount / (collectedAmount + overdueAmount)) *
                100
              ).toFixed(2),
            )
          : 0;

      result.push({
        staffId: staff.id,
        email: staff.email, // FIX
        collected: collectedAmount,
        overdue: overdueAmount,
        efficiency,
      });
    }

    return result;
  });
};

/**
 * ===========================
 * ASSET SEGMENTATION
 * ===========================
 */
exports.getAssetMetrics = async (businessId) => {
  return cache(`dash:assets:${businessId}`, 300, async () => {
    const assets = await prisma.contractAsset.findMany({
      where: { contract: { businessId } },
      include: {
        contract: true,
      },
    });

    const map = {};

    for (const a of assets) {
      if (!map[a.assetId]) {
        map[a.assetId] = {
          assetId: a.assetId,
          soldCount: 0,
          totalValue: 0,
          overdue: 0,
        };
      }

      map[a.assetId].soldCount += 1;
      map[a.assetId].totalValue += a.price || 0;

      const overdue = await prisma.installmentSchedule.aggregate({
        where: {
          contract: { businessId },
          dueDate: { lt: new Date() },
          status: { not: "PAID" },
        },
        _sum: { amount: true, amount: true },
      });

      map[a.assetId].overdue +=
        (overdue._sum.amount || 0) - (overdue._sum.amount || 0);
    }

    return Object.values(map);
  });
};

/**
 * ===========================
 * RISK ENGINE
 * ===========================
 */
exports.getRiskContracts = async (businessId) => {
  return cache(`dash:risk:${businessId}`, 300, async () => {
    const sevenDaysAgo = dayjs().subtract(7, "day").toDate();

    return prisma.contract.findMany({
      where: {
        businessId,
        schedules: {
          some: {
            dueDate: { lt: sevenDaysAgo },
            status: { not: "PAID" },
          },
        },
      },
      take: 20,
    });
  });
};

/**
 * ===========================
 * CASHFLOW
 * ===========================
 */
exports.getCashflow = async (businessId) => {
  return cache(`dash:cash:${businessId}`, 300, async () => {
    const compute = async (days) => {
      const future = dayjs().add(days, "day").toDate();

      const agg = await prisma.installmentSchedule.aggregate({
        where: { contract: { businessId }, dueDate: { lte: future } },
        _sum: { amount: true, amount: true },
      });

      return (agg._sum.amount || 0) - (agg._sum.amount || 0);
    };

    return {
      next30: await compute(30),
      next60: await compute(60),
      next90: await compute(90),
    };
  });
};

/**
 * ===========================
 * FUNNEL
 * ===========================
 */
exports.getFunnelMetrics = async (businessId) => {
  return cache(`dash:funnel:${businessId}`, 300, async () => {
    const customers = await prisma.customer.count({ where: { businessId } });
    const contracts = await prisma.contract.count({ where: { businessId } });

    const firstPayments = await prisma.payment.groupBy({
      by: ["contractId"],
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
      },
      _count: {
        _all: true,
      },
    });

    const completed = await prisma.contract.count({
      where: { businessId, status: "COMPLETED" },
    });

    return {
      customers,
      contracts,
      firstPayments: firstPayments.length,
      completed,
    };
  });
};

/**
 * ===========================
 * BUSINESS HEALTH SCORE
 * ===========================
 */
exports.getHealthScore = async (businessId) => {
  return cache(`dash:health:${businessId}`, 300, async () => {
    const collectedAgg = await prisma.payment.aggregate({
      where: {
        businessId,
        reversals: {
          none: {
            status: "APPROVED",
          },
        },
      },
      _sum: { amount: true },
    });

    const overdueAgg = await prisma.installmentSchedule.aggregate({
      where: {
        contract: { businessId },
        dueDate: { lt: new Date() },
        status: { not: "PAID" },
      },
      _sum: { amount: true, amount: true },
    });

    const collected = collectedAgg._sum.amount || 0;
    const overdue =
      (overdueAgg._sum.amount || 0) - (overdueAgg._sum.amount || 0);

    const overdueRatio =
      collected + overdue > 0 ? overdue / (collected + overdue) : 0;

    const collectionRate =
      collected + overdue > 0 ? collected / (collected + overdue) : 0;

    const churn = 0;

    const health = collectionRate * 100 - overdueRatio * 100 - churn * 100;

    return {
      collectionRate: Number((collectionRate * 100).toFixed(2)),
      overdueRatio: Number((overdueRatio * 100).toFixed(2)),
      churnRate: churn,
      healthScore: Number(health.toFixed(2)),
    };
  });
};
