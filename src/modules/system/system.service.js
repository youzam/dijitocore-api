const bcrypt = require("bcryptjs");
const prisma = require("../../config/prisma");

exports.bootstrapSystemService = async ({
  email,
  password,
  currency,
  trialDays,
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.systemSetting.findFirst();
    if (existing && existing.isBootstrapped) {
      const error = new Error("System already bootstrapped");
      error.statusCode = 403;
      throw error;
    }

    const settings = await tx.systemSetting.create({
      data: {
        currency,
        trialDays,
        isBootstrapped: true,
      },
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    const superAdmin = await tx.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "SYSTEM_BOOTSTRAP",
        actorId: superAdmin.id,
        actorRole: "SUPER_ADMIN",
        entity: "System",
        entityId: settings.id,
      },
    });

    return settings;
  });
};
