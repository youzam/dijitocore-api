const prisma = require("../../config/prisma");
const registry = require("../../utils/subscriptionFeatureRegistry");

const buildFeatureObject = (enabledKeys = []) => {
  const allKeys = registry.getFeatureKeys();

  const features = {};
  for (const key of allKeys) {
    features[key] = enabledKeys.includes(key);
  }

  return features;
};

const buildLimitObject = (limits = {}) => {
  const allKeys = registry.getLimitKeys();

  const result = {};
  for (const key of allKeys) {
    result[key] = limits[key] ?? null;
  }

  return result;
};

exports.seedSubscriptionPackages = async () => {
  const packages = [
    {
      name: "Starter",
      code: "STARTER",
      description: "Basic package",

      priceMonthly: 0,
      priceYearly: 0,
      setupFee: 0,
      trialDays: 7,

      features: buildFeatureObject(["allowContracts", "allowDashboard"]),

      limits: buildLimitObject({
        maxUsers: 1,
        maxActiveContracts: 10,
      }),
    },

    {
      name: "Standard",
      code: "STANDARD",
      description: "Standard business package",

      priceMonthly: 20000,
      priceYearly: 200000,
      setupFee: 0,
      trialDays: 7,

      features: buildFeatureObject([
        "allowContracts",
        "allowDashboard",
        "allowPayments",
        "allowSMS",
      ]),

      limits: buildLimitObject({
        maxUsers: 5,
        maxActiveContracts: 100,
        maxMonthlySms: 500,
      }),
    },

    {
      name: "Pro",
      code: "PRO",
      description: "Full featured package",

      priceMonthly: 50000,
      priceYearly: 500000,
      setupFee: 0,
      trialDays: 7,

      features: buildFeatureObject(registry.getFeatureKeys()),

      limits: buildLimitObject({
        maxUsers: 50,
        maxActiveContracts: 1000,
        maxMonthlySms: 5000,
      }),
    },
  ];

  for (const pkg of packages) {
    await prisma.subscriptionPackage.upsert({
      where: { code: pkg.code }, // 🔥 FIX: use UNIQUE FIELD

      update: {
        name: pkg.name,
        description: pkg.description,
        priceMonthly: pkg.priceMonthly,
        priceYearly: pkg.priceYearly,
        setupFee: pkg.setupFee,
        trialDays: pkg.trialDays,
        features: pkg.features,
        limits: pkg.limits,
        isActive: true,
      },

      create: pkg,
    });
  }
};
