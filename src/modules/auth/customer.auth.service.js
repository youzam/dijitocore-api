const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const notificationService = require('../../services/notifications/notification.service');
const coreAuth = require('./core.auth.service');
const { logAudit } = require('../../utils/audit.helper');
const securityService = require('../admin/security/security.service');
const privacyService = require('../privacy/privacy.service');

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
    throw new AppError('customer.blacklisted', 403);
  }

  if (customer.status !== 'ACTIVE') {
    throw new AppError('customer.inactive', 403);
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
    entityType: 'AUTH',
    entityId: phone,
    action: 'OTP_REQUESTED',
  });

  await notificationService.sendOtp({
    to: phone,
    locale: 'sw',
    otp,
  });
};

/**
 * Verify OTP
 */
exports.verifyOtp = async (phone, businessCode, otp, req) => {
  const business = await prisma.business.findUnique({
    where: { businessCode },
  });

  if (!business) {
    throw new AppError('auth.business_not_found', 404);
  }

  const customer = await prisma.customer.findUnique({
    where: {
      phone_businessId: {
        phone,
        businessId: business.id,
      },
    },
  });

  if (!customer || !customer.otpHash || !customer.otpExpiresAt) {
    throw new AppError('auth.invalid_otp', 400);
  }

  if (customer.otpExpiresAt < new Date()) {
    throw new AppError('auth.invalid_otp', 400);
  }

  // 🔥 CORE VALIDATION (ADDED)
  coreAuth.validateCustomerAccess(customer, business);

  const isValid = await bcrypt.compare(otp, customer.otpHash);

  if (!isValid) {
    await logAudit({
      businessId: business.id,
      customerId: customer.id,
      entityType: 'AUTH',
      entityId: customer.id,
      action: 'CUSTOMER_OTP_FAILED',
    });

    throw new AppError('auth.invalid_otp', 400);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
    },
  });

  // 🔥 LOGIN ACTIVITY (ADDED FOR CONSISTENCY)
  await prisma.loginActivity.create({
    data: {
      customerId: customer.id,
      status: 'SUCCESS',
      ipAddress: req?.ip || null,
    },
  });

  await securityService.detectLoginAnomaly(customer.id);

  // 🔥 CORE TOKEN
  const tokens = coreAuth.generateAuthTokens({
    sub: customer.id,
    identity_type: 'customer',
    businessId: customer.businessId,
    role: 'CUSTOMER',
    tokenVersion: customer.tokenVersion,
  });

  // 🔥 CORE SESSION
  await coreAuth.createCustomerSession({
    customerId: customer.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: business.id,
    customerId: customer.id,
    entityType: 'AUTH',
    entityId: customer.id,
    action: 'CUSTOMER_OTP_VERIFIED',
  });

  const forceConsent = !(await privacyService.hasAcceptedLatestTermsAndPrivacy({
    actorType: 'CUSTOMER',
    customerId: customer.id,
  }));

  return {
    customer: {
      id: customer.id,
      phone: customer.phone,
      businessId: customer.businessId,
    },
    tokens,
    forceConsent,
  };
};

/**
 * Set PIN
 */
exports.setPin = async (customerId, pin, req) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { business: true },
  });

  coreAuth.validateCustomerAccess(customer, customer?.business);

  const pinHash = await bcrypt.hash(pin, 10);

  await prisma.customer.update({
    where: { id: customerId },
    data: { pinHash },
  });

  await privacyService.acceptTermsAndPrivacy({
    actorType: 'CUSTOMER',
    customerId: customer.id,
    businessId: customer.businessId,
    source: 'CUSTOMER_PIN_SET',
    metadata: {
      acceptedTerms: true,
      acceptedPrivacy: true,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    deviceId: req.headers['x-device-id'] || null,
  });

  await logAudit({
    businessId: customer.businessId,
    customerId: customer.id,
    entityType: 'AUTH',
    entityId: customer.id,
    action: 'CUSTOMER_PIN_SET',
  });

  return true;
};

/**
 * Login with PIN
 */
exports.loginWithPin = async (phone, businessCode, pin, req) => {
  const business = await prisma.business.findUnique({
    where: { businessCode },
  });

  if (!business) {
    throw new AppError('auth.business_not_found', 404);
  }

  const customer = await prisma.customer.findUnique({
    where: {
      phone_businessId: {
        phone,
        businessId: business.id,
      },
    },
  });

  if (!customer) {
    throw new AppError('auth.customer_not_found', 404);
  }

  // 🔥 CORE VALIDATION (ADDED)
  coreAuth.validateCustomerAccess(customer, business);

  const valid = await bcrypt.compare(pin, customer.pinHash);

  if (!valid) {
    await prisma.loginActivity.create({
      data: {
        customerId: customer.id,
        status: 'FAILED',
        ipAddress: req.ip,
      },
    });

    await securityService.detectLoginAnomaly(customer.id);

    await logAudit({
      businessId: business.id,
      customerId: customer.id,
      entityType: 'AUTH',
      entityId: customer.id,
      action: 'CUSTOMER_LOGIN_FAILED',
    });

    throw new AppError('auth.invalid_credentials', 401);
  }

  await prisma.loginActivity.create({
    data: {
      customerId: customer.id,
      status: 'SUCCESS',
      ipAddress: req.ip,
    },
  });

  await securityService.detectLoginAnomaly(customer.id);

  // 🔥 CORE TOKEN (REPLACED signToken)
  const tokens = coreAuth.generateAuthTokens({
    sub: customer.id,
    identity_type: 'customer',
    businessId: customer.businessId,
    role: 'CUSTOMER',
    tokenVersion: customer.tokenVersion,
  });

  // 🔥 CORE SESSION (REPLACED manual create)
  await coreAuth.createCustomerSession({
    customerId: customer.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: business.id,
    customerId: customer.id,
    entityType: 'AUTH',
    entityId: customer.id,
    action: 'CUSTOMER_LOGIN_SUCCESS',
  });

  // 🔥 PATCH — CONSENT CHECK
  const forceConsent = !(await privacyService.hasAcceptedLatestTermsAndPrivacy({
    actorType: 'CUSTOMER',
    customerId: customer.id,
  }));

  return {
    customer: {
      id: customer.id,
      phone: customer.phone,
      businessId: customer.businessId,
    },
    tokens,
    forceConsent,
  };
};
