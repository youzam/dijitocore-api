const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");
const { logAudit } = require("../../../utils/audit.helper");

/**
 * Create Coupon
 */
exports.createCoupon = async (data, actor) => {
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

  await logAudit({
    userId: actor?.id || null,
    entityType: "COUPON",
    entityId: coupon.id,
    action: "COUPON_CREATED",
    metadata: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    },
    module: "COMMERCE",
    actorType: "ADMIN",
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
exports.updateCoupon = async (id, data, actor) => {
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

  const updated = await prisma.coupon.update({
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

  await logAudit({
    userId: actor?.id || null,
    entityType: "COUPON",
    entityId: id,
    action: "COUPON_UPDATED",
    metadata: {
      updatedFields: Object.keys(data),
    },
    module: "COMMERCE",
    actorType: "ADMIN",
  });

  return updated;
};
