const prisma = require("../config/prisma");
const { ScheduleStatus } = require("@prisma/client");
const {
  createNotification,
} = require("../services/notifications/notification.service");

const BATCH_SIZE = 500;
const MAX_LOOPS = 1000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

async function run() {
  const today = startOfDay(new Date());
  let cursor = null;
  let loopGuard = 0;

  try {
    while (loopGuard < MAX_LOOPS) {
      loopGuard++;

      const schedules = await prisma.installmentSchedule.findMany({
        where: {
          status: ScheduleStatus.DUE,
          dueDate: {
            lt: today,
          },
        },
        include: {
          contract: {
            include: {
              customer: true,
            },
          },
        },
        take: BATCH_SIZE,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy: { id: "asc" },
      });

      if (!schedules.length) break;

      // ✅ Remove N+1 business queries
      const businessIds = [
        ...new Set(
          schedules.map((s) => s.contract?.businessId).filter(Boolean),
        ),
      ];

      const businesses = await prisma.business.findMany({
        where: { id: { in: businessIds } },
        include: {
          users: {
            where: { status: "ACTIVE" },
          },
        },
      });

      const businessMap = new Map(businesses.map((b) => [b.id, b]));

      for (const s of schedules) {
        cursor = s.id;

        try {
          if (!s.contract || !s.contract.customer) continue;

          const customer = s.contract.customer;
          if (customer.status !== "ACTIVE") continue;

          const business = businessMap.get(s.contract.businessId);
          if (!business) continue;

          // ✅ Duplicate protection (same-day escalation)
          const existingToday = await prisma.notification.findFirst({
            where: {
              contractId: s.contract.id,
              type: "OVERDUE",
              createdAt: {
                gte: today,
              },
            },
          });

          if (existingToday) continue;

          /**
           * CUSTOMER NOTIFICATIONS
           */
          await Promise.all(
            ["IN_APP", "PUSH", "SMS", "WHATSAPP"].map((channel) =>
              createNotification({
                businessId: business.id,
                customerId: customer.id,
                contractId: s.contract.id,
                type: "OVERDUE",
                channel,
                titleKey: "notification.overdue.title",
                messageKey: "notification.overdue.body",
                templateVars: {
                  name: customer.fullName,
                  amount: s.amount,
                  dueDate: s.dueDate,
                },
                recipient: channel === "IN_APP" ? customer.id : customer.phone,
              }),
            ),
          );

          /**
           * BUSINESS ESCALATION
           */
          await Promise.all(
            (business.users || [])
              .filter((u) => ["BUSINESS_OWNER", "MANAGER"].includes(u.role))
              .map(async (u) => {
                await createNotification({
                  businessId: business.id,
                  userId: u.id,
                  contractId: s.contract.id,
                  type: "OVERDUE",
                  channel: "IN_APP",
                  titleKey: "notification.staff_overdue.title",
                  messageKey: "notification.staff_overdue.body",
                  templateVars: {
                    customer: customer.fullName,
                    amount: s.amount,
                    dueDate: s.dueDate,
                  },
                  recipient: u.id,
                });

                if (u.email) {
                  await createNotification({
                    businessId: business.id,
                    userId: u.id,
                    contractId: s.contract.id,
                    type: "OVERDUE",
                    channel: "EMAIL",
                    titleKey: "notification.staff_overdue.title",
                    messageKey: "notification.staff_overdue.body",
                    templateVars: {
                      customer: customer.fullName,
                      amount: s.amount,
                      dueDate: s.dueDate,
                    },
                    recipient: u.email,
                  });
                }
              }),
          );
        } catch (err) {
          console.error("Escalation processing failed:", s.id, err);
        }
      }
    }
  } catch (error) {
    console.error("Escalation cron failed:", error);
    throw error;
  }
}

module.exports = { run };
