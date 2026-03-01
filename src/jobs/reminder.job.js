const prisma = require("../config/prisma");
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

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

async function run() {
  const today = startOfDay(new Date());
  const upcomingWindow = addDays(today, 7);

  let cursor = null;
  let loopGuard = 0;

  try {
    while (loopGuard < MAX_LOOPS) {
      loopGuard++;

      const schedules = await prisma.installmentSchedule.findMany({
        where: {
          status: "DUE",
          dueDate: {
            lte: upcomingWindow,
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
          users: true,
          notificationSettings: {
            where: { userId: null },
            take: 1,
          },
        },
      });

      const businessMap = new Map(businesses.map((b) => [b.id, b]));

      for (const s of schedules) {
        cursor = s.id;

        if (!s.contract || !s.contract.customer) continue;

        const customer = s.contract.customer;
        const business = businessMap.get(s.contract.businessId);

        if (!business) continue;
        if (customer.status !== "ACTIVE") continue;

        const setting = business.notificationSettings[0] || null;

        const daysBeforeDue =
          typeof setting?.daysBeforeDue === "number"
            ? setting.daysBeforeDue
            : 3;

        const dueDate = startOfDay(s.dueDate);
        const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

        // UPCOMING
        if (
          dueDate.getTime() ===
          startOfDay(addDays(today, daysBeforeDue)).getTime()
        ) {
          await Promise.all(
            ["IN_APP", "PUSH", "SMS", "WHATSAPP"].map((channel) =>
              createNotification({
                businessId: business.id,
                customerId: customer.id,
                contractId: s.contract.id,
                type: "UPCOMING",
                channel,
                titleKey: "notification.upcoming.title",
                messageKey: "notification.upcoming.body",
                templateVars: {
                  name: customer.fullName,
                  amount: s.amount,
                },
                recipient: channel === "IN_APP" ? customer.id : customer.phone,
              }),
            ),
          );
        }

        // DUE TODAY
        if (dueDate.getTime() === today.getTime()) {
          await Promise.all(
            ["IN_APP", "PUSH", "SMS", "WHATSAPP"].map((channel) =>
              createNotification({
                businessId: business.id,
                customerId: customer.id,
                contractId: s.contract.id,
                type: "DUE",
                channel,
                titleKey: "notification.due.title",
                messageKey: "notification.due.body",
                templateVars: {
                  name: customer.fullName,
                  amount: s.amount,
                },
                recipient: channel === "IN_APP" ? customer.id : customer.phone,
              }),
            ),
          );
        }

        // OVERDUE
        if (daysDiff > 0) {
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

          await Promise.all(
            ["IN_APP", "PUSH"].map((channel) =>
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
                },
                recipient: channel === "IN_APP" ? customer.id : customer.phone,
              }),
            ),
          );

          await Promise.all(
            (business.users || []).map(async (u) => {
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
                  },
                  recipient: u.email,
                });
              }
            }),
          );
        }
      }
    }
  } catch (error) {
    throw error;
  }
}

module.exports = { run };
