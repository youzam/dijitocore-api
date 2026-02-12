const prisma = require("../../config/prisma");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const AppError = require("../../utils/AppError");

/**
 * Get notification settings (business-level or user-level)
 */
exports.getSettings = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;
  const userId = req.user.id;

  const settings = await prisma.notificationSetting.findMany({
    where: {
      businessId,
      OR: [{ userId }, { userId: null }],
    },
  });

  return response.success(
    req,
    res,
    settings,
    200,
    "notification.settings_list",
  );
});

/**
 * Update notification settings
 */
exports.updateSettings = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;
  const userId = req.user.id;
  const data = req.body;

  const setting = await prisma.notificationSetting.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId,
      },
    },
  });

  if (!setting) {
    throw new AppError("notification.settings_not_found", 404);
  }

  await prisma.notificationSetting.update({
    where: { id: setting.id },
    data,
  });

  return response.success(req, res, null, 200, "notification.settings_updated");
});
