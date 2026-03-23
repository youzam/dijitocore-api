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
| Update Currency
|--------------------------------------------------------------------------
*/
exports.updateCurrency = async (currency, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: { currency },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_CURRENCY",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.currency,
      newValue: currency,
    },
  });

  return updated;
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
| Update API Config
|--------------------------------------------------------------------------
*/
exports.updateApiConfig = async (data, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      apiConfig: data,
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_API_CONFIG",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.apiConfig,
      newValue: data,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Update Notification Config
|--------------------------------------------------------------------------
*/
exports.updateNotificationConfig = async (data, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      notificationConfig: data,
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_NOTIFICATION_CONFIG",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.notificationConfig,
      newValue: data,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Update Branding Config
|--------------------------------------------------------------------------
*/
exports.updateBrandingConfig = async (data, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      brandingConfig: data,
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_BRANDING_CONFIG",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.brandingConfig,
      newValue: data,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Update Maintenance Config
|--------------------------------------------------------------------------
*/
exports.updateMaintenanceConfig = async (data, adminId) => {
  const settings = await getSettingsRow();

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      maintenanceConfig: data,
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: "SYSTEM_SETTING",
    entityId: settings.id,
    action: "UPDATE_MAINTENANCE_CONFIG",
    module: "SETTINGS",
    actorType: "ADMIN",
    metadata: {
      oldValue: settings.maintenanceConfig,
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
