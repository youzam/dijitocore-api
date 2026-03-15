const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * ===== INTERNAL HELPERS =====
 */

/**
 * Validate pricing
 */
const validatePricing = (price) => {
  if (price === undefined || price === null) return;

  if (Number(price) < 0) {
    throw new AppError("subscription.invalid_package_price", 400);
  }
};

/**
 * Validate JSON structure (features / limits)
 * NOTE: Replace with real registry if exists in your system
 */
const validateConfigJSON = (data, type) => {
  if (!data) return;

  if (typeof data !== "object") {
    throw new AppError(`subscription.invalid_${type}_format`, 400);
  }
};

/**
 * Audit helper (lightweight, uses metadata pattern if no audit table)
 */
const buildAuditMetadata = (existingMeta, changes, userId) => {
  return {
    ...(existingMeta || {}),
    lastUpdatedBy: userId,
    lastUpdatedAt: new Date(),
    changes,
  };
};

/**
 * ===== SERVICES =====
 */

/**
 * Create Package
 */
exports.createPackage = async (data, req) => {
  const { name, code, price, currency, features, limits, isActive } = data;

  if (!name || !code || price === undefined) {
    throw new AppError("subscription.invalid_package_data", 400);
  }

  validatePricing(price);
  validateConfigJSON(features, "features");
  validateConfigJSON(limits, "limits");

  const existing = await prisma.subscriptionPackage.findUnique({
    where: { code },
  });

  if (existing) {
    throw new AppError("subscription.package_code_exists", 400);
  }

  const pkg = await prisma.subscriptionPackage.create({
    data: {
      name,
      code,
      price,
      currency: currency || "USD",
      features: features || {},
      limits: limits || {},
      isActive: typeof isActive === "boolean" ? isActive : true,
      metadata: {
        createdBy: req.user.id,
        createdAt: new Date(),
      },
    },
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
    throw new AppError("subscription.package_not_found", 404);
  }

  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.subscriptionPackage.findUnique({
      where: { code: data.code },
    });

    if (duplicate) {
      throw new AppError("subscription.package_code_exists", 400);
    }
  }

  validatePricing(data.price);

  const changes = {};

  if (data.name) changes.name = { from: existing.name, to: data.name };
  if (data.price !== undefined)
    changes.price = { from: existing.price, to: data.price };
  if (data.isActive !== undefined)
    changes.isActive = { from: existing.isActive, to: data.isActive };

  const updated = await prisma.subscriptionPackage.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.code && { code: data.code }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.currency && { currency: data.currency }),
      ...(typeof data.isActive === "boolean" && {
        isActive: data.isActive,
      }),

      metadata: buildAuditMetadata(existing.metadata, changes, req.user.id),
    },
  });

  return updated;
};

/**
 * Update Package Configuration (features + limits)
 */
exports.updatePackageConfiguration = async (id, data, req) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError("subscription.package_not_found", 404);
  }

  validateConfigJSON(data.features, "features");
  validateConfigJSON(data.limits, "limits");

  const updated = await prisma.subscriptionPackage.update({
    where: { id },
    data: {
      ...(data.features && {
        features: {
          ...(existing.features || {}),
          ...data.features,
        },
      }),
      ...(data.limits && {
        limits: {
          ...(existing.limits || {}),
          ...data.limits,
        },
      }),
      metadata: buildAuditMetadata(
        existing.metadata,
        {
          configUpdated: true,
        },
        req.user.id,
      ),
    },
  });

  return updated;
};

/**
 * Deactivate Package (Blueprint requirement)
 */
exports.deactivatePackage = async (id, req) => {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError("subscription.package_not_found", 404);
  }

  if (!existing.isActive) {
    throw new AppError("subscription.package_already_inactive", 400);
  }

  const updated = await prisma.subscriptionPackage.update({
    where: { id },
    data: {
      isActive: false,
      metadata: buildAuditMetadata(
        existing.metadata,
        { deactivated: true },
        req.user.id,
      ),
    },
  });

  return updated;
};

/**
 * Get all packages
 */
exports.getPackages = async () => {
  return prisma.subscriptionPackage.findMany({
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Get single package
 */
exports.getPackageById = async (id) => {
  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });

  if (!pkg) {
    throw new AppError("subscription.package_not_found", 404);
  }

  return pkg;
};
