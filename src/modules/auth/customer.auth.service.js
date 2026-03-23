const bcrypt = require("bcryptjs");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const jwtConfig = require("../../config/jwt");
const { signToken, verifyToken } = require("../../utils/auth.helper");
const notificationService = require("../../services/notifications/notification.service");

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Request OTP
 */
exports.requestOtp = async (phone, businessCode) => {
  const business = await prisma.business.findUnique({
    where: { businessCode },
  });

  if (!business) return;

  const customer = await prisma.customer.findUnique({
    where: {
      phone_businessId: {
        phone,
        businessId: business.id,
      },
    },
  });

  if (!customer) return;

  if (customer.isBlacklisted) {
    throw new AppError("customer.blacklisted", 403);
  }

  if (customer.status !== "ACTIVE") {
    throw new AppError("customer.inactive", 403);
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  await logAudit({
    businessId: business.id,
    userId: null,
    entityType: "AUTH",
    entityId: phone,
    action: "OTP_REQUESTED",
  });

  await notificationService.sendOtp({
    to: phone,
    locale: "sw",
    otp,
  });
};

/**
 * Verify OTP
 */
exports.verifyOtp = async (phone, businessCode, otp) => {
  const business = await prisma.business.findUnique({
    where: { businessCode },
  });

  if (!business) throw new AppError("auth.customer_not_found", 404);

  const customer = await prisma.customer.findUnique({
    where: {
      phone_businessId: {
        phone,
        businessId: business.id,
      },
    },
  });

  if (!customer || !customer.otpHash || !customer.otpExpiresAt)
    throw new AppError("auth.invalid_otp", 400);

  if (customer.otpExpiresAt < new Date())
    throw new AppError("auth.invalid_otp", 400);

  const isValid = await bcrypt.compare(otp, customer.otpHash);

  if (!isValid) throw new AppError("auth.invalid_otp", 400);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
    },
  });

  await logAudit({
    businessId: business.id,
    userId: customer.id,
    entityType: "AUTH",
    entityId: customer.id,
    action: "CUSTOMER_LOGIN_SUCCESS",
  });

  return customer;
};

/**
 * Set PIN
 */
exports.setPin = async (customerId, pin) => {
  const pinHash = await bcrypt.hash(pin, 10);

  await prisma.customer.update({
    where: { id: customerId },
    data: { pinHash },
  });
};

/**
 * Login with PIN
 */
exports.loginWithPin = async (phone, businessCode, pin, req) => {
  const business = await prisma.business.findUnique({
    where: { businessCode },
  });

  if (!business) throw new AppError("auth.customer_not_found", 404);

  const customer = await prisma.customer.findUnique({
    where: {
      phone_businessId: {
        phone,
        businessId: business.id,
      },
    },
  });

  if (!customer || !customer.pinHash)
    throw new AppError("auth.pin_not_set", 400);

  const isValid = await bcrypt.compare(pin, customer.pinHash);

  /**
   * =====================================================
   * FAILED LOGIN
   * =====================================================
   */
  if (!isValid) {
    // 🔥 LOGIN ACTIVITY
    await prisma.loginActivity.create({
      data: {
        userId: customer.id, // treat customer as user
        status: "FAILED",
        ipAddress: req.ip,
      },
    });

    // 🔥 DETECT ANOMALY
    await securityService.detectLoginAnomaly(customer.id);
    await logAudit({
      businessId: null,
      userId: null,
      entityType: "AUTH",
      entityId: phone,
      action: "CUSTOMER_LOGIN_FAILED",
    });
    throw new AppError("auth.invalid_pin", 401);
  }

  if (customer.isBlacklisted) {
    await logAudit({
      businessId: null,
      userId: null,
      entityType: "AUTH",
      entityId: phone,
      action: "CUSTOMER_LOGIN_FAILED",
    });
    throw new AppError("customer.blacklisted", 403);
  }

  if (customer.status !== "ACTIVE") {
    await logAudit({
      businessId: null,
      userId: null,
      entityType: "AUTH",
      entityId: phone,
      action: "CUSTOMER_LOGIN_FAILED",
    });
    throw new AppError("customer.inactive", 403);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  /**
   * =====================================================
   * SUCCESS LOGIN
   * =====================================================
   */

  // 🔥 LOGIN ACTIVITY
  await prisma.loginActivity.create({
    data: {
      userId: customer.id,
      status: "SUCCESS",
      ipAddress: req.ip,
    },
  });

  // 🔥 DETECT ANOMALY
  await securityService.detectLoginAnomaly(customer.id);

  /**
   * JWT TOKENS (aligned with auth.middleware)
   */
  const tokens = signToken({
    sub: customer.id,
    identity_type: "customer",
    businessId: customer.businessId,
    role: "CUSTOMER",
  });

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    businessId: customer.businessId,
    userId: customer.id,
    entityType: "AUTH",
    entityId: customer.id,
    action: "CUSTOMER_LOGIN_SUCCESS",
  });

  return {
    customer: {
      id: customer.id,
      phone: customer.phone,
      businessId: customer.businessId,
    },
    tokens,
  };
};
