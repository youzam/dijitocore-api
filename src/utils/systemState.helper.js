const prisma = require("../config/prisma");

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

exports.isJobExecutionAllowed = async () => {
  const settings = await getSystemSettingsCached();

  const flags = settings?.featureFlags || {};

  return flags.EMERGENCY_SHUTDOWN !== true;
};
