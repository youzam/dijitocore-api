const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");
const { SubscriptionStatus } = require("@prisma/client");

module.exports = async function subscriptionLifecycleJob() {
  const now = new Date();

  /* ======================================================
     MOVE ACTIVE/TRIAL → GRACE
  ====================================================== */

  const toGrace = await prisma.subscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
      },
      endDate: { not: null, lt: now },
      graceUntil: null,
    },
    select: {
      id: true,
      businessId: true,
    },
  });

  for (const sub of toGrace) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.GRACE,
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
    } catch (error) {
      // Prevent one failure from stopping entire job
      console.error(
        `Lifecycle GRACE transition failed for subscription ${sub.id}`,
        error,
      );
    }
  }

  /* ======================================================
     HANDLE GRACE → SUSPENDED
  ====================================================== */

  const expiredGrace = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.GRACE,
      graceUntil: { not: null, lt: now },
    },
    select: {
      id: true,
      businessId: true,
    },
  });

  for (const sub of expiredGrace) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.SUSPENDED },
        });

        await tx.business.update({
          where: { id: sub.businessId },
          data: {
            status: "INACTIVE",
          },
        });

        await auditHelper.logAudit({
          tx,
          businessId: sub.businessId,
          entityType: "SUBSCRIPTION",
          entityId: sub.id,
          action: "SUSPENDED_EXPIRED",
        });
      });
    } catch (error) {
      console.error(
        `Lifecycle SUSPEND transition failed for subscription ${sub.id}`,
        error,
      );
    }
  }
};
