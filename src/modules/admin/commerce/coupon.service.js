const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * Validate coupon restrictions (internal use)
 */
const validateCouponRestrictions = (coupon) => {
  const now = new Date();

  if (!coupon.isActive) {
    throw new AppError("commerce.coupon_inactive", 400);
  }

  if (coupon.validFrom && now < coupon.validFrom) {
    throw new AppError("commerce.coupon_not_started", 400);
  }

  if (coupon.validTo && now > coupon.validTo) {
    throw new AppError("commerce.coupon_expired", 400);
  }

  if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
    throw new AppError("commerce.coupon_usage_exceeded", 400);
  }
};

/**
 * Create Coupon
 */
exports.createCoupon = async (data) => {
  const { code, type, value, maxUsage, validFrom, validTo, isActive } = data;

  if (!code || !type || !value) {
    throw new AppError("commerce.invalid_coupon_data", 400);
  }

  if (!["PERCENTAGE", "FIXED"].includes(type)) {
    throw new AppError("commerce.invalid_coupon_type", 400);
  }

  if (Number(value) <= 0) {
    throw new AppError("commerce.invalid_coupon_value", 400);
  }

  const existing = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (existing) {
    throw new AppError("commerce.coupon_exists", 400);
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      type,
      value,
      maxUsage: maxUsage || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return coupon;
};

/**
 * Get Coupons (with filters)
 */
exports.getCoupons = async (query) => {
  const { isActive, code } = query;

  return prisma.coupon.findMany({
    where: {
      ...(typeof isActive !== "undefined" && {
        isActive: isActive === "true",
      }),
      ...(code && {
        code: {
          contains: code,
          mode: "insensitive",
        },
      }),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Update Coupon
 */
exports.updateCoupon = async (id, data) => {
  const existing = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError("commerce.coupon_not_found", 404);
  }

  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (duplicate) {
      throw new AppError("commerce.coupon_exists", 400);
    }
  }

  return prisma.coupon.update({
    where: { id },
    data: {
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.type && { type: data.type }),
      ...(data.value && { value: data.value }),
      ...(typeof data.isActive === "boolean" && {
        isActive: data.isActive,
      }),
      ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
      ...(data.validTo && { validTo: new Date(data.validTo) }),
      ...(data.maxUsage && { maxUsage: data.maxUsage }),
    },
  });
};

/**
 * Apply Coupon (usage tracking + abuse protection)
 */
exports.applyCoupon = async ({ code, businessId }) => {
  if (!code) {
    throw new AppError("commerce.coupon_required", 400);
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) {
    throw new AppError("commerce.coupon_not_found", 404);
  }

  // Validate rules
  validateCouponRestrictions(coupon);

  // Check abuse (same business using too many times)
  const usageCount = await prisma.couponUsage.count({
    where: {
      couponId: coupon.id,
      businessId,
    },
  });

  if (usageCount >= 5) {
    // threshold ya abuse (configurable later)
    throw new AppError("commerce.coupon_abuse_detected", 400);
  }

  // Record usage
  await prisma.couponUsage.create({
    data: {
      couponId: coupon.id,
      businessId,
    },
  });

  // Increment usage counter
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: {
      usageCount: {
        increment: 1,
      },
    },
  });

  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
  };
};
