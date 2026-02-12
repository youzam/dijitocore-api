const prisma = require("../config/prisma");
const {
  createNotification,
} = require("../services/notifications/notification.service");

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
  const today = startOfDay(new Date());

  /**
   * Load all pending schedules with relations
   */
  const schedules = await prisma.installmentSchedule.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      contract: {
        include: {
          customer: true,
          business: {
            include: {
              users: true,
              notificationSettings: {
                where: { userId: null }, // business-level setting
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  for (const s of schedules) {
    if (!s.contract || !s.contract.customer) continue;

    const customer = s.contract.customer;
    const business = s.contract.business;

    // customer must be ACTIVE
    if (customer.status !== "ACTIVE") continue;

    const setting = business.notificationSettings[0] || null;

    // fallback to schema default (3) if setting missing
    const daysBeforeDue =
      typeof setting?.daysBeforeDue === "number" ? setting.daysBeforeDue : 3;

    const dueDate = startOfDay(s.dueDate);
    const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    /**
     * UPCOMING (X days before due)
     */
    if (
      dueDate.getTime() === startOfDay(addDays(today, daysBeforeDue)).getTime()
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
     * DUE TODAY
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
     * OVERDUE
     */
    if (daysDiff > 0) {
      // customer notifications
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

      // business users (owner / manager / staff)
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
};
