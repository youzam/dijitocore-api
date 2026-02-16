const bcrypt = require("bcryptjs");
const prisma = require("../../config/prisma");

async function seedDefaultPackages() {
  const existing = await prisma.subscriptionPackage.count();

  if (existing > 0) return;

  await prisma.subscriptionPackage.createMany({
    data: [
      {
        name: "Starter",
        code: "STARTER",
        description: "Starter plan",
        priceMonthly: 20000,
        setupFee: 0,
        trialDays: 7,
        features: {
          maxCustomers: 100,
          allowImport: false,
          allowSMS: false,
        },
      },
      {
        name: "Pro",
        code: "PRO",
        description: "Professional plan",
        priceMonthly: 50000,
        setupFee: 10000,
        trialDays: 14,
        features: {
          maxCustomers: 500,
          allowImport: true,
          allowSMS: true,
        },
      },
      {
        name: "Premium",
        code: "PREMIUM",
        description: "Premium plan",
        priceMonthly: 100000,
        setupFee: 20000,
        trialDays: 14,
        features: {
          maxCustomers: -1,
          allowImport: true,
          allowSMS: true,
        },
      },
    ],
  });
}

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
        activePaymentGateway: "SELCOM",
        currency,
        trialDays,
        isBootstrapped: true,
      },
    });

    await seedDefaultPackages();

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

        // Actor
        userId: superAdmin.id,
        businessId: null,

        // Entity
        entityType: "System",
        entityId: settings.id,

        metadata: {
          description: "Initial system bootstrap",
          role: "SUPER_ADMIN",
        },

        ipAddress: null,
        userAgent: null,
      },
    });

    return settings;
  });
};
