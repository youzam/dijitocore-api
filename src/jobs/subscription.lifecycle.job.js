const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");

const BATCH_SIZE = 200;
const GRACE_DAYS = 7;
const MAX_LOOPS = 1000;

async function run() {
  const now = new Date();
  let cursor = null;
  let loopGuard = 0;

  try {
    while (loopGuard < MAX_LOOPS) {
      loopGuard++;

      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: { in: ["ACTIVE", "TRIAL", "GRACE"] },
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
              // Defensive re-check inside transaction
              const current = await tx.subscription.findUnique({
                where: { id: sub.id },
              });

              if (
                !current ||
                !["ACTIVE", "TRIAL"].includes(current.status) ||
                current.graceUntil
              ) {
                return;
              }

              await tx.subscription.update({
                where: { id: sub.id },
                data: {
                  status: "GRACE",
                  graceUntil: new Date(
                    now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
                  ),
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
              const current = await tx.subscription.findUnique({
                where: { id: sub.id },
              });

              if (
                !current ||
                current.status !== "GRACE" ||
                !current.graceUntil ||
                current.graceUntil > now
              ) {
                return;
              }

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
  } catch (error) {
    console.error("Subscription lifecycle cron failed:", error);
    throw error;
  }
}

module.exports = {
  run,
};
