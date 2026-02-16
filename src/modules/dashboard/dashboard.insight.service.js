const prisma = require("../../config/prisma");
const dayjs = require("dayjs");

/**
 * =============================
 * SMART INSIGHTS GENERATOR
 * =============================
 */
exports.generateInsights = async (businessId) => {
  const today = dayjs().startOf("day");
  const yesterday = today.subtract(1, "day");

  const todaySnap = await prisma.dashboardSnapshot.findFirst({
    where: { businessId, snapshotDate: today.toDate() },
  });

  const yesterdaySnap = await prisma.dashboardSnapshot.findFirst({
    where: { businessId, snapshotDate: yesterday.toDate() },
  });

  // 🔒 Always return consistent type
  if (!todaySnap || !yesterdaySnap) {
    return [];
  }

  const insights = [];

  /**
   * Overdue spike
   */
  const overdueChange =
    yesterdaySnap.overdue > 0
      ? ((todaySnap.overdue - yesterdaySnap.overdue) / yesterdaySnap.overdue) *
        100
      : 0;

  if (overdueChange > 10) {
    insights.push({
      type: "OVERDUE_SPIKE",
      messageKey: "insights.overdue_spike",
      payload: { percent: Number(overdueChange.toFixed(2)) },
    });
  }

  /**
   * Collection drop
   */
  const collectionChange =
    yesterdaySnap.collected > 0
      ? ((todaySnap.collected - yesterdaySnap.collected) /
          yesterdaySnap.collected) *
        100
      : 0;

  if (collectionChange < -10) {
    insights.push({
      type: "COLLECTION_DROP",
      messageKey: "insights.collection_drop",
      payload: { percent: Number(collectionChange.toFixed(2)) },
    });
  }

  /**
   * Persist insights safely (prevent duplicates)
   */
  for (const i of insights) {
    const existing = await prisma.dashboardInsight.findFirst({
      where: {
        businessId,
        type: i.type,
        createdAt: {
          gte: today.toDate(),
        },
      },
    });

    if (!existing) {
      await prisma.dashboardInsight.create({
        data: {
          businessId,
          type: i.type,
          messageKey: i.messageKey,
          payload: i.payload,
        },
      });
    }
  }

  return insights;
};

/**
 * =============================
 * FETCH INSIGHTS
 * =============================
 */
exports.getInsights = async (businessId) => {
  return prisma.dashboardInsight.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
};
