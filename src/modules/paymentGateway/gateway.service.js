const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const healthService = require('../../utils/paymentGateway/gateway.health');

/**
 * ============================================
 * SIMPLE IN-MEMORY CACHE
 * ============================================
 */
let cache = {
  data: null,
  expiresAt: 0,
};

const CACHE_TTL = 60 * 1000; // 60 seconds

exports.getActivePaymentGateways = async () => {
  const now = Date.now();

  /**
   * ✅ RETURN CACHE IF VALID
   */
  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  /**
   * 🔄 FETCH FRESH DATA
   */
  const settings = await prisma.systemSetting.findFirst();

  if (!settings) {
    throw new AppError('settings.not_found', 404);
  }

  const systemGateways = settings.activePaymentGateways || [];

  if (systemGateways.length === 0) {
    cache = { data: [], expiresAt: now + CACHE_TTL };
    return [];
  }

  const availableGateways = [];

  for (const gateway of systemGateways) {
    const status = await healthService.getStatus(gateway);

    if (status === 'UP') {
      availableGateways.push(gateway);
    }
  }

  /**
   * 🔥 BUSINESS RULE
   */
  let finalGateways = availableGateways;

  if (availableGateways.includes('SELCOM')) {
    finalGateways = ['SELCOM'];
  }

  /**
   * 💾 SAVE TO CACHE
   */
  cache = {
    data: finalGateways,
    expiresAt: now + CACHE_TTL,
  };

  return finalGateways;
};
