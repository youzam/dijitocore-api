const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");
const auditHelper = require("../../../utils/audit.helper");

/*
|--------------------------------------------------------------------------
| Get Settings (FULL)
|--------------------------------------------------------------------------
*/
exports.getSettings = async () => {
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError("settings.not_found", 404);
  }

  return settings;
};

/*
|--------------------------------------------------------------------------
| Internal Helper (ensure row exists)
|--------------------------------------------------------------------------
*/
const getSettingsRow = async () => {
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError("settings.not_found", 404);
  }

  return settings;
};

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
exports.updateActiveGateway = async (gateway, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: { activePaymentGateway: gateway },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_PAYMENT_GATEWAY",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.activePaymentGateway,
      newValue: gateway,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Update Security Config
|--------------------------------------------------------------------------
*/
exports.updateSecurityConfig = async (data, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      maxLoginAttempts: data.maxLoginAttempts,
      lockTimeMinutes: data.lockTimeMinutes,
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_SECURITY_CONFIG",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: {
        maxLoginAttempts: settings.maxLoginAttempts,
        lockTimeMinutes: settings.lockTimeMinutes,
      },
      newValue: data,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Get Settings History (from Audit Logs)
|--------------------------------------------------------------------------
*/
exports.getSettingsHistory = async () => {
  const logs = await prisma.auditLog.findMany({
    where: {
      module: "SETTINGS",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs;
};
