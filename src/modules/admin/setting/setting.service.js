const prisma = require('../../../config/prisma');
const AppError = require('../../../utils/AppError');
const auditHelper = require('../../../utils/audit.helper');
const {
  SUPPORTED_PAYMENT_GATEWAYS,
} = require('../../../utils/paymentGateway/supportedGateways');

/*
|--------------------------------------------------------------------------
| Get Settings (FULL)
|--------------------------------------------------------------------------
*/
exports.getSettings = async () => {
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError('settings.not_found', 404);
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
    throw new AppError('settings.not_found', 404);
  }

  return settings;
};

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
exports.updateActiveGateways = async (gateways, adminId) => {
  const settings = await getSettingsRow();

  const supportedGateways = SUPPORTED_PAYMENT_GATEWAYS;

  // 🔥 validate array
  if (!Array.isArray(gateways) || gateways.length === 0) {
    throw new AppError('settings.invalid_gateways', 400);
  }

  for (const g of gateways) {
    if (!supportedGateways.includes(g)) {
      throw new AppError('settings.invalid_gateway', 400);
    }
  }

  const updated = await prisma.systemSetting.update({
    where: { id: settings.id },
    data: {
      activePaymentGateways: gateways, // 🔥 ARRAY NOW
    },
  });

  await auditHelper.logAudit({
    userId: adminId,
    entityType: 'SYSTEM_SETTING',
    entityId: settings.id,
    action: 'UPDATE_PAYMENT_GATEWAYS',
    module: 'SETTINGS',
    actorType: 'ADMIN',
    metadata: {
      oldValue: settings.activePaymentGateways,
      newValue: gateways,
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
    entityType: 'SYSTEM_SETTING',
    entityId: settings.id,
    action: 'UPDATE_SECURITY_CONFIG',
    module: 'SETTINGS',
    actorType: 'ADMIN',
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
      module: 'SETTINGS',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return logs;
};
