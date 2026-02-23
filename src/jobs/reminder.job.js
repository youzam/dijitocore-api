const prisma = require("../config/prisma");
const {
  createNotification,
} = require("../services/notifications/notification.service");

const jobService = require("../modules/system/system.job.service");

const BATCH_SIZE = 500; // 🔒 Added batching only

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

module.exports = async () => {
  const startedAt = new Date();

  try {
    const today = startOfDay(new Date());
    const upcomingWindow = addDays(today, 7);

    let cursor = null;

    while (true) {
      const schedules = await prisma.installmentSchedule.findMany({
        where: {
          status: "PENDING",
          dueDate: {
            lte: upcomingWindow, // 🔒 Added filter only
          },
        },
        include: {
          contract: {
            include: {
              customer: true,
              business: {
                include: {
                  users: true,
                  notificationSettings: {
                    where: { userId: null },
                    take: 1,
                  },
                },
              },
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

      for (const s of schedules) {
        cursor = s.id;

        if (!s.contract || !s.contract.customer) continue;

        const customer = s.contract.customer;
        const business = s.contract.business;

        if (customer.status !== "ACTIVE") continue;

        const setting = business.notificationSettings[0] || null;

        const daysBeforeDue =
          typeof setting?.daysBeforeDue === "number"
            ? setting.daysBeforeDue
            : 3;

        const dueDate = startOfDay(s.dueDate);
        const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

        /**
         * UPCOMING (unchanged)
         */
        if (
          dueDate.getTime() ===
          startOfDay(addDays(today, daysBeforeDue)).getTime()
        ) {
          for (const channel of ["IN_APP", "PUSH", "SMS", "WHATSAPP"]) {
            await createNotification({
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
            });
          }
        }

        /**
         * DUE TODAY (unchanged)
         */
        if (dueDate.getTime() === today.getTime()) {
          for (const channel of ["IN_APP", "PUSH", "SMS", "WHATSAPP"]) {
            await createNotification({
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
            });
          }
        }

        /**
         * OVERDUE (unchanged logic + dedup guard)
         */
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

          for (const channel of ["IN_APP", "PUSH"]) {
            await createNotification({
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
            });
          }

          for (const u of business.users || []) {
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
          }
        }
      }
    }

    await jobService.logJobExecution({
      jobName: "reminder_job",
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    await jobService.logJobExecution({
      jobName: "reminder_job",
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: error.message,
    });

    throw error;
  }
};
