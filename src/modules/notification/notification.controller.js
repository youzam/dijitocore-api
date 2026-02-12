const prisma = require("../../config/prisma");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const AppError = require("../../utils/AppError");
const {
  createNotification,
} = require("../../services/notifications/notification.service");

/**
 * =====================================================
 * GET NOTIFICATION INBOX
 * (Business user OR Customer)
 * =====================================================
 */
exports.getNotifications = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;

  const where = {
    businessId,
  };

  /**
   * BUSINESS USER
   */
  if (req.auth.identityType === "business") {
    where.userId = req.user.id;
  }

  /**
   * CUSTOMER
   */
  if (req.auth.identityType === "customer") {
    where.customerId = req.auth.customer.id;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return response.success(req, res, notifications, 200, "notification.list");
});

/**
 * =====================================================
 * MARK NOTIFICATION AS READ
 * =====================================================
 */
exports.markAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    throw new AppError("notification.id_required", 400);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return response.success(req, res, null, 200, "notification.marked_read");
});

/**
 * =====================================================
 * BULK NOTIFICATION
 * (Business users only)
 * =====================================================
 */
exports.bulkNotify = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;

  const {
    customerIds = [],
    titleKey,
    messageKey,
    templateVars = {},
    channels = ["IN_APP", "PUSH", "SMS", "WHATSAPP"],
  } = req.body;

  if (!titleKey || !messageKey) {
    throw new AppError("notification.template_required", 400);
  }

  /**
   * BULK LIMITS
   * - max 1 per week
   * - max 4 per month
   */
  const now = new Date();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const weekly = await prisma.bulkNotificationLimit.findUnique({
    where: {
      businessId_weekStart: {
        businessId,
        weekStart,
      },
    },
  });

  if (weekly && weekly.count >= 1) {
    throw new AppError("notification.bulk_week_limit", 400);
  }

  const monthlyCount = await prisma.notification.count({
    where: {
      businessId,
      type: "BULK",
      createdAt: { gte: monthStart },
    },
  });

  if (monthlyCount >= 4) {
    throw new AppError("notification.bulk_month_limit", 400);
  }

  /**
   * Load ACTIVE customers
   */
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: {
          id: { in: customerIds },
          businessId,
          status: "ACTIVE",
        },
      })
    : await prisma.customer.findMany({
        where: {
          businessId,
          status: "ACTIVE",
        },
      });

  for (const c of customers) {
    for (const channel of channels) {
      await createNotification({
        businessId,
        customerId: c.id,
        type: "BULK",
        channel,
        titleKey,
        messageKey,
        templateVars,
        recipient: channel === "IN_APP" ? c.id : c.phone,
      });
    }
  }

  /**
   * Update weekly counter
   */
  if (weekly) {
    await prisma.bulkNotificationLimit.update({
      where: { id: weekly.id },
      data: { count: { increment: 1 } },
    });
  } else {
    await prisma.bulkNotificationLimit.create({
      data: {
        businessId,
        weekStart,
        count: 1,
      },
    });
  }

  return response.success(req, res, null, 200, "notification.bulk_sent");
});
