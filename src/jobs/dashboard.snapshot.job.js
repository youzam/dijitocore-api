const cron = require("node-cron");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");

const dashboardService = require("../modules/dashboard/dashboard.service");
const insightService = require("../modules/dashboard/dashboard.insight.service");

/**
 * ==================================
 * DASHBOARD SNAPSHOT JOB
 * ==================================
 */

exports.start = () => {
  cron.schedule("5 0 * * *", async () => {
    console.log("Running dashboard snapshot job...");

    const businesses = await prisma.business.findMany({
      select: { id: true },
    });

    for (const biz of businesses) {
      const businessId = biz.id;

      try {
        const health = await dashboardService.getHealthScore(businessId);
        const cashflow = await dashboardService.getCashflow(businessId);
        const staff = await dashboardService.getStaffMetrics(businessId);
        const assets = await dashboardService.getAssetMetrics(businessId);

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
         * MAIN SNAPSHOT
         */
        await prisma.dashboardSnapshot.upsert({
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

        /**
         * STAFF METRICS
         */
        for (const s of staff) {
          await prisma.dashboardStaffMetric.create({
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

        /**
         * ASSET METRICS
         */
        for (const a of assets) {
          await prisma.dashboardAssetMetric.create({
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

        /**
         * HEALTH SNAPSHOT
         */
        await prisma.dashboardHealth.upsert({
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
        await insightService.generateInsights(businessId);
        console.log(`Dashboard snapshot saved for business ${businessId}`);
      } catch (err) {
        console.error("Dashboard snapshot failed:", err);
      }
    }
  });
};
