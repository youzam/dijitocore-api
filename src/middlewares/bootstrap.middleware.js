const prisma = require("../config/prisma");

async function bootstrapGuard(req, res, next) {
  const settings = await prisma.systemSetting.findFirst();

  if (settings && settings.isBootstrapped) {
    return res.status(403).json({
      success: false,
      message:
        "System already bootstrapped. This action is permanently locked.",
    });
  }

  next();
}

module.exports = bootstrapGuard;
