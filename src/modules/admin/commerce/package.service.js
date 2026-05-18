const prisma = require('../../../config/prisma');
const AppError = require('../../../utils/AppError');
const registry = require('../../../utils/subscriptionFeatureRegistry');
const { logAudit } = require('../../../utils/audit.helper');

/**
 * Validate pricing
 */
const validatePricing = (priceMonthly, priceYearly) => {
  if (priceMonthly !== undefined && Number(priceMonthly) < 0) {
    throw new AppError('subscription.invalid_package_monthly_price', 400);
  }

  if (priceYearly !== undefined && Number(priceYearly) < 0) {
    throw new AppError('subscription.invalid_package_yearly_price', 400);
  }
};

/**
 * Validate JSON structure (features / limits)
 */
const validateConfigJSON = (data, type) => {
  if (!data) return {};

  if (typeof data !== 'object') {
    throw new AppError(`subscription.invalid_${type}_format`, 400);
  }

  const validated = {};

  if (type === 'features') {
    for (const key of Object.keys(data)) {
      if (!registry.isValidFeatureKey(key)) {
        throw new AppError(`Invalid feature key: ${key}`, 400);
      }

      if (typeof data[key] !== 'boolean') {
        throw new AppError(`Feature must be boolean: ${key}`, 400);
      }
    }

    for (const key of registry.getFeatureKeys()) {
      validated[key] = data[key] ?? false;
    }
  }

  if (type === 'limits') {
    for (const key of Object.keys(data)) {
      if (!registry.isValidLimitKey(key)) {
        throw new AppError(`Invalid limit key: ${key}`, 400);
      }

      const value = data[key];

      if (value !== null && (typeof value !== 'number' || value < 0)) {
        throw new AppError(`Invalid limit value: ${key}`, 400);
      }
    }

    for (const key of registry.getLimitKeys()) {
      validated[key] = data[key] ?? null;
    }
  }

  return validated;
};

/**
 * Create Package
 */
exports.createPackage = async (data, req) => {
  const {
    name,
    code,
    description,
    priceMonthly,
    priceYearly,
    setupFee,
    features,
    limits,
    isActive,
  } = data;

  if (!name || !code || priceMonthly === undefined) {
    throw new AppError('subscription.invalid_package_data', 400);
  }

  validatePricing(priceMonthly, priceYearly);

  const validatedFeatures = validateConfigJSON(features, 'features');

  const validatedLimits = validateConfigJSON(limits, 'limits');

  const existing = await prisma.subscriptionPackage.findUnique({
    where: { code },
  });

  if (existing) {
    throw new AppError('subscription.package_code_exists', 400);
  }

  const pkg = await prisma.subscriptionPackage.create({
    data: {
      name,
      description,
      code,
      priceMonthly,
      priceYearly: priceYearly ?? null,
      setupFee: setupFee ?? 0,
      features: validatedFeatures,
      limits: validatedLimits,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    },
  });

  await logAudit({
    userId: req.auth?.id || null,
    entityType: 'PACKAGE',
    entityId: pkg.id,
    action: 'PACKAGE_CREATED',

    metadata: {
      name: pkg.name,
      code: pkg.code,
      priceMonthly: pkg.priceMonthly,
      priceYearly: pkg.priceYearly,
      setupFee: pkg.setupFee,
    },

    module: 'COMMERCE',
    actorType: 'ADMIN',
  });

  return pkg;
};

/**
 * Update Package (basic + pricing)
 */
exports.updatePackage = async (id, data, req) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('subscription.package_not_found', 404);
  }

  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.subscriptionPackage.findUnique({
      where: {
        code: data.code,
      },
    });

    if (duplicate) {
      throw new AppError('subscription.package_code_exists', 400);
    }
  }

  validatePricing(data.priceMonthly, data.priceYearly);

  const changes = {};

  if (data.name) {
    changes.name = {
      from: existing.name,
      to: data.name,
    };
  }

  if (data.priceMonthly !== undefined) {
    changes.priceMonthly = {
      from: existing.priceMonthly,
      to: data.priceMonthly,
    };
  }

  if (data.priceYearly !== undefined) {
    changes.priceYearly = {
      from: existing.priceYearly,
      to: data.priceYearly,
    };
  }

  if (data.isActive !== undefined) {
    changes.isActive = {
      from: existing.isActive,
      to: data.isActive,
    };
  }

  const updated = await prisma.subscriptionPackage.update({
    where: { id },

    data: {
      ...(data.name && {
        name: data.name,
      }),

      ...(data.code && {
        code: data.code,
      }),

      ...(data.priceMonthly !== undefined && {
        priceMonthly: data.priceMonthly,
      }),

      ...(data.priceYearly !== undefined && {
        priceYearly: data.priceYearly,
      }),

      ...(data.setupFee !== undefined && {
        setupFee: data.setupFee,
      }),

      ...(typeof data.isActive === 'boolean' && {
        isActive: data.isActive,
      }),
    },
  });

  await logAudit({
    userId: req.auth?.id || null,
    entityType: 'PACKAGE',
    entityId: id,
    action: 'PACKAGE_UPDATED',

    metadata: {
      changes,
    },

    module: 'COMMERCE',
    actorType: 'ADMIN',
  });

  return updated;
};

/**
 * Update Package Configuration (features + limits)
 */
exports.updatePackageConfiguration = async (id, data, actor) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('subscription.package_not_found', 404);
  }

  const validatedFeatures = data.features
    ? validateConfigJSON(data.features, 'features')
    : null;

  const validatedLimits = data.limits
    ? validateConfigJSON(data.limits, 'limits')
    : null;

  const updated = await prisma.subscriptionPackage.update({
    where: { id },

    data: {
      ...(validatedFeatures && {
        features: validatedFeatures,
      }),

      ...(validatedLimits && {
        limits: validatedLimits,
      }),
    },
  });

  await logAudit({
    userId: actor?.id || null,
    entityType: 'PACKAGE',
    entityId: id,
    action: 'PACKAGE_CONFIG_UPDATED',

    metadata: {
      featuresUpdated: !!data.features,

      limitsUpdated: !!data.limits,
    },

    module: 'COMMERCE',
    actorType: 'ADMIN',
  });

  return updated;
};

/**
 * Deactivate Package
 */
exports.deactivatePackage = async (id, req) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('subscription.package_not_found', 404);
  }

  if (!existing.isActive) {
    throw new AppError('subscription.package_already_inactive', 400);
  }

  const updated = await prisma.subscriptionPackage.update({
    where: { id },

    data: {
      isActive: false,

      metadata: {
        deactivated: true,
        actor: req.user.id,
      },
    },
  });

  await logAudit({
    userId: req.auth?.id || null,
    entityType: 'PACKAGE',
    entityId: id,
    action: 'PACKAGE_DEACTIVATED',

    module: 'COMMERCE',
    actorType: 'ADMIN',
  });

  return updated;
};

/**
 * Get single package
 */
exports.getPackageById = async (id) => {
  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!pkg) {
    throw new AppError('subscription.package_not_found', 404);
  }

  return pkg;
};
