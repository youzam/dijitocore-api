const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const auditHelper = require("../../utils/audit.helper");

const ALLOWED_GATEWAYS = ["SELCOM", "MPESA", "AIRTEL"];

exports.getActiveGateway = async () => {
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError("system.settings_not_found", 404);
  }

  return settings.activePaymentGateway;
};

exports.updateActiveGateway = async ({ gateway, userId }) => {
  const pendingPayments = await prisma.subscriptionPayment.count({
    where: { status: "PENDING" },
  });

  if (pendingPayments > 0) {
    throw new AppError("system.gateway_switch_blocked", 400);
  }

  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError("system.settings_not_found", 404);
  }

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: { activePaymentGateway: gateway },
  });

  await auditHelper.logAudit({
    userId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_GATEWAY",
  });

  return updated.activePaymentGateway;
};
