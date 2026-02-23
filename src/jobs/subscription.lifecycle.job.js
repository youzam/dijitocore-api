const prisma = require("../config/prisma");
const jobService = require("../modules/system/system.job.service");
const auditHelper = require("../utils/audit.helper");

const BATCH_SIZE = 200;

async function runSubscriptionLifecycle() {
  const startedAt = new Date();

  try {
    const now = new Date();
    let cursor = null;

    while (true) {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: {
            in: ["ACTIVE", "TRIAL", "GRACE"],
          },
          endDate: {
            not: null,
            lte: now,
          },
        },
        take: BATCH_SIZE,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy: { id: "asc" },
      });

      if (!subscriptions.length) break;

      for (const sub of subscriptions) {
        cursor = sub.id;

        try {
          /**
           * ACTIVE/TRIAL → GRACE
           */
          if (
            ["ACTIVE", "TRIAL"].includes(sub.status) &&
            sub.endDate &&
            sub.endDate <= now &&
            !sub.graceUntil
          ) {
            await prisma.$transaction(async (tx) => {
              await tx.subscription.update({
                where: { id: sub.id },
                data: {
                  status: "GRACE",
                  graceUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                },
              });

              await auditHelper.logAudit({
                tx,
                businessId: sub.businessId,
                entityType: "SUBSCRIPTION",
                entityId: sub.id,
                action: "MOVED_TO_GRACE",
              });
            });

            continue;
          }

          /**
           * GRACE → SUSPENDED
           */
          if (
            sub.status === "GRACE" &&
            sub.graceUntil &&
            sub.graceUntil <= now
          ) {
            await prisma.$transaction(async (tx) => {
              await tx.subscription.update({
                where: { id: sub.id },
                data: { status: "SUSPENDED" },
              });

              await tx.business.update({
                where: { id: sub.businessId },
                data: { status: "INACTIVE" },
              });

              await auditHelper.logAudit({
                tx,
                businessId: sub.businessId,
                entityType: "SUBSCRIPTION",
                entityId: sub.id,
                action: "SUSPENDED_EXPIRED",
              });
            });
          }
        } catch (err) {
          console.error(
            "Subscription lifecycle transition failed:",
            sub.id,
            err,
          );
        }
      }
    }

    await jobService.logJobExecution({
      jobName: "subscription_lifecycle_job",
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    await jobService.logJobExecution({
      jobName: "subscription_lifecycle_job",
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: error.message,
    });

    console.error("Subscription lifecycle cron failed:", error);
  }
}

module.exports = {
  runSubscriptionLifecycle,
};
