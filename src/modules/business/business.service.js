const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const authHelper = require('../../utils/auth.helper');

/**
 * Generate professional business code
 * Example: DIJI-0482
 */
const generateBusinessCode = (businessName) => {
  const prefix = businessName
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase();

  const randomDigits = Math.floor(1000 + Math.random() * 9000);

  return `${prefix}-${randomDigits}`;
};

/**
 * Generate unique business code with retry
 */
const generateUniqueBusinessCode = async (businessName, attempts = 5) => {
  for (let i = 0; i < attempts; i++) {
    const code = generateBusinessCode(businessName);

    const exists = await prisma.business.findUnique({
      where: { businessCode: code },
    });

    if (!exists) return code;
  }

  throw new AppError('business.codeGenerationFailed', 500);
};

/**
 * =========================
 * CREATE BUSINESS
 * =========================
 */
exports.createBusiness = async (user, payload) => {
  if (user.businessId) {
    throw new AppError('business.alreadyExists', 400);
  }

  const { name, email, phone, currency, country, timezone } = payload;

  if (!name || !currency || !timezone || !country) {
    throw new AppError('business.missingRequired', 400);
  }

  const normalizedEmail = email.toLowerCase();

  const existingBusiness = await prisma.business.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingBusiness) {
    throw new AppError('business email already exists', 409);
  }

  const businessCode = await generateUniqueBusinessCode(name);

  const business = await prisma.business.create({
    data: {
      name,
      email: normalizedEmail,
      phone,
      country,
      businessCode,
      status: 'PENDING',
      setupCompleted: false,
      settings: {
        create: {
          currency,
          timezone,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      businessId: business.id,
      role: 'BUSINESS_OWNER',
    },
  });

  await prisma.notificationSetting.create({
    data: {
      businessId: business.id,
      userId: null, // business-level default
    },
  });

  const tokens = authHelper.signToken({
    sub: user.id,
    role: 'BUSINESS_OWNER',
    business_id: business.id,
    identity_type: 'business',
  });

  return {
    business,
    tokens,
  };
};

/**
 * =========================
 * SETTINGS
 * =========================
 */
exports.getBusinessSettings = async (businessId) => {
  return prisma.businessSettings.findUnique({
    where: { businessId },
  });
};

exports.updateBusinessSettings = async (user, payload) => {
  if (user.role !== 'BUSINESS_OWNER') {
    throw new AppError('auth.forbidden', 403);
  }

  const { currency, timezone } = payload;

  return prisma.businessSettings.update({
    where: { businessId: user.businessId },
    data: {
      currency,
      timezone,
    },
  });
};

/**
 * =========================
 * GET BUSINESS DETAILS
 * =========================
 */
exports.getBusinessDetails = async (businessId) => {
  if (!businessId) {
    throw new AppError('business.notFound', 404);
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      settings: true,
      users: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!business) {
    throw new AppError('business.notFound', 404);
  }

  return business;
};

/**
 * =========================
 * GET MY BUSINESS
 * =========================
 */
exports.getMyBusiness = async (user) => {
  if (!user.businessId) {
    throw new AppError('business.notFound', 404);
  }

  const business = await prisma.business.findUnique({
    where: {
      id: user.businessId,
    },

    include: {
      settings: true,

      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!business) {
    throw new AppError('business.notFound', 404);
  }

  return business;
};
