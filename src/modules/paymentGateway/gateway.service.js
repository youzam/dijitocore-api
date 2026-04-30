const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const healthService = require("../../utils/paymentGateway/gateway.health");

exports.getActivePaymentGateways = async () => {
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError("settings.not_found", 404);
  }

  const systemGateways = settings.activePaymentGateways || [];

  if (systemGateways.length === 0) {
    return [];
  }

  const availableGateways = [];

  for (const gateway of systemGateways) {
    const status = await healthService.getStatus(gateway);

    if (status === "UP") {
      availableGateways.push(gateway);
    }
  }

  // 🔥 BUSINESS RULE
  // Selcom covers mobile → override others
  if (availableGateways.includes("SELCOM")) {
    return ["SELCOM"];
  }

  return availableGateways;
};
