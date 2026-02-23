const prisma = require("../config/prisma");
const {
  createNotification,
} = require("../services/notifications/notification.service");

const jobService = require("../modules/system/system.job.service");

const BATCH_SIZE = 500;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

module.exports = async () => {
  const startedAt = new Date();

  try {
    const today = startOfDay(new Date());

    let cursor = null;

    while (true) {
      const schedules = await prisma.installmentSchedule.findMany({
        where: {
          status: "PENDING",
          dueDate: {
            lt: today,
          },
        },
        include: {
          contract: {
            include: {
              customer: true,
              business: {
                include: {
                  users: {
                    where: { status: "ACTIVE" },
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

        /**
         * CUSTOMER NOTIFICATIONS (unchanged)
         */
        for (const channel of ["IN_APP", "PUSH", "SMS", "WHATSAPP"]) {
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
              dueDate: s.dueDate,
            },
            recipient: channel === "IN_APP" ? customer.id : customer.phone,
          });
        }

        /**
         * BUSINESS ESCALATION (unchanged)
         */
        for (const u of business.users || []) {
          if (!["BUSINESS_OWNER", "MANAGER"].includes(u.role)) continue;

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
        }
      }
    }

    await jobService.logJobExecution({
      jobName: "escalation_job",
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    await jobService.logJobExecution({
      jobName: "escalation_job",
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: error.message,
    });

    throw error;
  }
};
