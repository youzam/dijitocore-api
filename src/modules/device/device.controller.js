const prisma = require("../../config/prisma");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const AppError = require("../../utils/AppError");

/**
 * Register device push token
 * Called automatically by app after login
 */
exports.registerDevice = catchAsync(async (req, res) => {
  const { token, platform } = req.body;

  if (!token || !platform) {
    throw new AppError("device.invalid_payload", 400);
  }

  const data = {
    token,
    platform,
  };

  // Business user
  if (req.auth?.identityType === "business") {
    data.userId = req.user.id;
  }

  // Customer
  if (req.auth?.identityType === "customer") {
    data.customerId = req.user.id;
  }

  if (!data.userId && !data.customerId) {
    throw new AppError("auth.unauthorized", 401);
  }

  await prisma.deviceToken.upsert({
    where: { token },
    update: data,
    create: data,
  });

  return response.success(req, res, null, 200, "device.registered");
});
