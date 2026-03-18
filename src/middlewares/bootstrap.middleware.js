const prisma = require("../config/prisma");

async function bootstrapGuard(req, res, next) {
  const settings = await prisma.systemSetting.findFirst();

  const isBootstrapRoute = req.originalUrl.includes("/bootstrap");

  // 🔴 BEFORE BOOTSTRAP → block everything except bootstrap
  if (!settings || !settings.isBootstrapped) {
    if (!isBootstrapRoute) {
      return res.status(503).json({
        success: false,
        message: "System not initialized. Please complete bootstrap.",
      });
    }

    return next();
  }

  // 🔴 AFTER BOOTSTRAP → block bootstrap route only
  if (settings.isBootstrapped && isBootstrapRoute) {
    return res.status(403).json({
      success: false,
      message:
        "System already bootstrapped. This action is permanently locked.",
    });
  }

  next();
}

module.exports = bootstrapGuard;
