const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const jwtConfig = require("../../config/jwt");
const notificationService = require("../../services/notifications/notification.service");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
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
exports.loginWithPin = async (phone, businessCode, pin) => {
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

  if (!isValid) throw new AppError("auth.invalid_pin", 401);

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  const payload = {
    customerId: customer.id,
    businessId: customer.businessId,
    role: "CUSTOMER",
  };

  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiresIn,
  });

  const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    customer,
  };
};
