const prisma = require("../../../config/prisma");

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

export default {
  seedDefaultPackages,
};
