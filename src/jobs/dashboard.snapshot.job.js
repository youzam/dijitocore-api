const prisma = require("../config/prisma");
const dashboardService = require("../modules/dashboard/dashboard.service");
const insightService = require("../modules/dashboard/dashboard.insight.service");
const jobService = require("../modules/system/system.job.service");
const dayjs = require("dayjs");

const BATCH_SIZE = 50; // 🔒 Added batching only

async function runDashboardSnapshot() {
  const startedAt = new Date();

  try {
    let cursor = null;

    while (true) {
      const businesses = await prisma.business.findMany({
        select: { id: true },
        take: BATCH_SIZE,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy: { id: "asc" },
      });

      if (!businesses.length) break;

      for (const b of businesses) {
        cursor = b.id;
        const businessId = b.id;

        try {
          /**
           * =========================
           * AGGREGATIONS (unchanged)
           * =========================
           */

          const health =
            await dashboardService.calculateHealthScore(businessId);

          const staff = await dashboardService.getStaffMetrics(businessId);

          const assets = await dashboardService.getAssetMetrics(businessId);

          const cashflow =
            await dashboardService.getCashflowMetrics(businessId);

          const contractsAgg = await prisma.contract.aggregate({
            where: { businessId },
            _sum: { totalAmount: true },
          });

          const paymentsAgg = await prisma.payment.aggregate({
            where: { businessId, reversed: false },
            _sum: { amount: true },
          });

          const overdueAgg = await prisma.paymentSchedule.aggregate({
            where: {
              businessId,
              dueDate: { lt: new Date() },
              status: { not: "PAID" },
            },
            _sum: { amount: true, paidAmount: true },
          });

          const portfolio = contractsAgg._sum.totalAmount || 0;
          const collected = paymentsAgg._sum.amount || 0;
          const overdue =
            (overdueAgg._sum.amount || 0) - (overdueAgg._sum.paidAmount || 0);
          const outstanding = portfolio - collected;

          const today = dayjs().startOf("day").toDate();

          /**
           * =========================
           * WRITES (atomic per business)
           * =========================
           */
          await prisma.$transaction(async (tx) => {
            await tx.dashboardSnapshot.upsert({
              where: {
                businessId_snapshotDate: {
                  businessId,
                  snapshotDate: today,
                },
              },
              update: {
                portfolio,
                collected,
                outstanding,
                overdue,
                cashflow30: cashflow.next30,
                cashflow60: cashflow.next60,
                cashflow90: cashflow.next90,
              },
              create: {
                businessId,
                snapshotDate: today,
                portfolio,
                collected,
                outstanding,
                overdue,
                cashflow30: cashflow.next30,
                cashflow60: cashflow.next60,
                cashflow90: cashflow.next90,
              },
            });

            for (const s of staff) {
              await tx.dashboardStaffMetric.create({
                data: {
                  businessId,
                  staffId: s.staffId,
                  collected: s.collected,
                  overdue: s.overdue,
                  efficiency: s.efficiency,
                  snapshotDate: today,
                },
              });
            }

            for (const a of assets) {
              await tx.dashboardAssetMetric.create({
                data: {
                  businessId,
                  assetId: a.assetId,
                  soldCount: a.soldCount,
                  totalValue: a.totalValue,
                  overdue: a.overdue,
                  snapshotDate: today,
                },
              });
            }

            await tx.dashboardHealth.upsert({
              where: {
                businessId_snapshotDate: {
                  businessId,
                  snapshotDate: today,
                },
              },
              update: {
                collectionRate: health.collectionRate,
                overdueRatio: health.overdueRatio,
                churnRate: health.churnRate,
                healthScore: health.healthScore,
              },
              create: {
                businessId,
                snapshotDate: today,
                collectionRate: health.collectionRate,
                overdueRatio: health.overdueRatio,
                churnRate: health.churnRate,
                healthScore: health.healthScore,
              },
            });
          });

          await insightService.generateInsights(businessId);
        } catch (err) {
          console.error(
            "Dashboard snapshot failed for business:",
            businessId,
            err,
          );
        }
      }
    }

    await jobService.logJobExecution({
      jobName: "dashboard_snapshot_job",
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    await jobService.logJobExecution({
      jobName: "dashboard_snapshot_job",
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: error.message,
    });

    console.error("Dashboard snapshot cron failed:", error);
  }
}

module.exports.start = () => {
  setInterval(
    async () => {
      await runDashboardSnapshot();
    },
    24 * 60 * 60 * 1000,
  );
};
