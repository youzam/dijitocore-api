const prisma = require("../../config/prisma");

exports.validateCouponForBusiness = async ({ code, businessId }) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code },
  });

  if (!coupon) {
    throw new Error("Coupon not found");
  }

  if (!coupon.isActive) {
    throw new Error("Coupon is inactive");
  }

  const now = new Date();

  if (coupon.validFrom && now < coupon.validFrom) {
    throw new Error("Coupon not started yet");
  }

  if (coupon.validTo && now > coupon.validTo) {
    throw new Error("Coupon expired");
  }

  // 🔹 GLOBAL LIMIT
  if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
    throw new Error("Coupon global usage exceeded");
  }

  // 🔹 BUSINESS LIMIT
  const businessUsageCount = await prisma.couponUsage.count({
    where: {
      couponId: coupon.id,
      businessId,
    },
  });

  if (
    coupon.maxUsagePerBusiness &&
    businessUsageCount >= coupon.maxUsagePerBusiness
  ) {
    throw new Error("Coupon usage exceeded for this business");
  }

  return {
    coupon,
    businessUsageCount,
  };
};

exports.calculateCouponDiscount = (coupon, amount) => {
  let discount = 0;

  const base = Number(amount);

  if (coupon.type === "PERCENTAGE") {
    discount = (base * Number(coupon.value)) / 100;
  }

  if (coupon.type === "FIXED") {
    discount = Number(coupon.value);
  }

  // 🔹 SAFETY: discount cannot exceed amount
  if (discount > base) {
    discount = base;
  }

  return discount;
};

exports.applyCouponForCheckout = async ({ code, businessId, amount }) => {
  const { coupon } = await exports.validateCouponForBusiness({
    code,
    businessId,
  });

  const discount = exports.calculateCouponDiscount(coupon, amount);

  return {
    couponId: coupon.id,
    code: coupon.code,
    discount,
  };
};
