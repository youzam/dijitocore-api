const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const response = require("../utils/response");

let cachedSettings = null;
let lastFetch = 0;
const CACHE_TTL = 60000;

async function getSystemSettingsCached() {
  const now = Date.now();

  if (cachedSettings && now - lastFetch < CACHE_TTL) {
    return cachedSettings;
  }

  const settings = await prisma.systemSetting.findFirst();

  cachedSettings = settings;
  lastFetch = now;

  return settings;
}

module.exports = async (req, res, next) => {
  try {
    const url = req.originalUrl || "";

    /*
    |--------------------------------------------------------------------------
    | ROUTE DETECTION (HARDENED)
    |--------------------------------------------------------------------------
    */
    const isAdminRoute = url.startsWith("/admin") || url.includes("/admin/");

    const isHealthRoute =
      url.startsWith("/health") || url.startsWith("/metrics");

    const isAuthRoute = url.includes("/auth"); // hardened

    const isSubscriptionRoute = url.includes("/subscriptions"); // hardened

    // Always allow health
    if (isHealthRoute) return next();

    const settings = await getSystemSettingsCached();
    const flags = settings?.featureFlags || {};

    /*
    |--------------------------------------------------------------------------
    | 🔴 EMERGENCY SHUTDOWN (STRONGEST)
    |--------------------------------------------------------------------------
    */
    if (flags.EMERGENCY_SHUTDOWN === true) {
      if (!isAdminRoute) {
        return response.error(req, res, "system.emergency_shutdown", 503);
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 🔴 MAINTENANCE MODE
    |--------------------------------------------------------------------------
    */
    if (flags.MAINTENANCE_MODE === true) {
      if (!isAdminRoute) {
        return response.error(req, res, "system.maintenance_mode", 503);
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 🔴 AUTH CONTROL
    |--------------------------------------------------------------------------
    */
    if (flags.AUTH_ENABLED === false && isAuthRoute && !isAdminRoute) {
      return response.error(req, res, "auth.disabled", 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 🔴 API WRITE CONTROL
    |--------------------------------------------------------------------------
    */
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

    if (
      flags.API_WRITE_ENABLED === false &&
      writeMethods.includes(req.method) &&
      !isAdminRoute
    ) {
      return response.error(req, res, "system.write_disabled", 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 🔴 SaaS SUBSCRIPTION PAYMENTS CONTROL
    |--------------------------------------------------------------------------
    */
    if (
      flags.PAYMENT_ENABLED === false &&
      isSubscriptionRoute &&
      writeMethods.includes(req.method) &&
      !isAdminRoute
    ) {
      return response.error(req, res, "payment.disabled", 403);
    }

    return next();
  } catch (error)  {
    return next(error);
  }
};
