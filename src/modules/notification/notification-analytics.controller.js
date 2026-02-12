const prisma = require("../../config/prisma");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

/**
 * Notification analytics dashboard
 */
exports.getAnalytics = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;

  const total = await prisma.notification.count({ where: { businessId } });
  const sent = await prisma.notification.count({
    where: { businessId, status: "SENT" },
  });
  const failed = await prisma.notification.count({
    where: { businessId, status: "FAILED" },
  });
  const read = await prisma.notification.count({
    where: { businessId, status: "READ" },
  });

  return response.success(
    req,
    res,
    {
      total,
      sent,
      failed,
      read,
      deliveryRate: total ? Math.round((sent / total) * 100) : 0,
    },
    200,
    "notification.analytics",
  );
});
