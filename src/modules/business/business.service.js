const crypto = require("crypto");

const notifications = require("../../services/notifications");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const authHelper = require("../../utils/auth.helper");

/**
 * Generate professional business code
 * Example: DIJI-0482
 */
const generateBusinessCode = (businessName) => {
  const prefix = businessName
    .replace(/[^a-zA-Z]/g, "")
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

  throw new AppError("business.codeGenerationFailed", 500);
};

/**
 * =========================
 * CREATE BUSINESS
 * =========================
 */
exports.createBusiness = async (user, payload) => {
  if (user.businessId) {
    throw new AppError("business.alreadyExists", 400);
  }

  const { name, email, phone, currency, timezone } = payload;

  if (!name || !currency || !timezone) {
    throw new AppError("business.missingRequired", 400);
  }

  const businessCode = await generateUniqueBusinessCode(name);

  const business = await prisma.business.create({
    data: {
      name,
      email,
      phone,
      businessCode,
      status: "PENDING",
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
      role: "BUSINESS_OWNER",
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
    role: "BUSINESS_OWNER",
    business_id: business.id,
    identity_type: "business",
  });

  return {
    business,
    tokens,
  };
};

/**
 * =========================
 * BUSINESS LIFECYCLE
 * =========================
 */
exports.updateBusinessStatus = async (businessId, status) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError("business.notFound", 404);
  }

  if (business.status === "TERMINATED") {
    throw new AppError("business.alreadyTerminated", 400);
  }

  const allowedTransitions = {
    PENDING: ["ACTIVE", "TERMINATED"],
    ACTIVE: ["GRACE", "TERMINATED"],
    GRACE: ["ACTIVE", "SUSPENDED"],
    SUSPENDED: ["ACTIVE", "TERMINATED"],
    TERMINATED: [],
  };

  if (!allowedTransitions[business.status]?.includes(status)) {
    throw new AppError("business.invalidTransition", 400);
  }

  return prisma.business.update({
    where: { id: businessId },
    data: { status },
  });
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
  if (user.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
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
 * INVITE BUSINESS USER
 * =========================
 */
exports.inviteBusinessUser = async (owner, payload) => {
  const { email, role } = payload;

  const existingUser = await prisma.user.findUnique({
    where: {
      email_businessId: {
        email,
        businessId: owner.businessId,
      },
    },
  });

  if (existingUser) {
    throw new AppError("user.emailExists", 400);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.businessInvite.create({
    data: {
      email,
      role,
      tokenHash,
      expiresAt,
      businessId: owner.businessId,
    },
  });

  const inviteUrl = `${process.env.FRONTEND_URL}/invite?token=${rawToken}`;

  await notifications.sendBusinessInvite({
    to: email,
    inviteUrl,
    role,
  });

  return {
    invited: true,
    email,
    role,
  };
};

exports.listInvites = async (businessId) => {
  return prisma.businessInvite.findMany({
    where: { businessId },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.revokeInvite = async (businessId, inviteId) => {
  return prisma.businessInvite.delete({
    where: {
      id: inviteId,
      businessId,
    },
  });
};

/**
 * =========================
 * ACTIVE USERS
 * =========================
 */
exports.listBusinessUsers = async (businessId) => {
  return prisma.user.findMany({
    where: { businessId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

exports.updateBusinessUser = async (owner, userId, payload) => {
  return prisma.user.update({
    where: { id: userId },
    data: payload,
  });
};

exports.deactivateBusinessUser = async (owner, userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
};

exports.activateBusinessUser = async (owner, userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });
};

/**
 * =========================
 * GET BUSINESS DETAILS
 * =========================
 */
exports.getBusinessDetails = async (businessId) => {
  if (!businessId) {
    throw new AppError("business.notFound", 404);
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
    throw new AppError("business.notFound", 404);
  }

  return business;
};
