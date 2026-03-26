const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const jwtConfig = require("../../config/jwt");
const { signToken, verifyToken } = require("../../utils/auth.helper");

// ======================================================
// 🧠 USER VALIDATION
// ======================================================
const validateUserAccess = (user) => {
  if (!user) {
    throw new AppError("auth.unauthorized", 401);
  }

  if (user.isDeleted) {
    throw new AppError("auth.account_deleted", 403);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("auth.account_inactive", 403);
  }

  if (!user.emailVerified) {
    throw new AppError("auth.email_not_verified", 403);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError("auth.account_locked", 423);
  }

  if (user.business && user.business.isDeleted) {
    throw new AppError("business.deleted", 403);
  }

  return user;
};

// ======================================================
// 🧠 CUSTOMER VALIDATION
// ======================================================
const validateCustomerAccess = (customer, business) => {
  if (!customer) {
    throw new AppError("auth.unauthorized", 401);
  }

  if (customer.isDeleted) {
    throw new AppError("auth.account_deleted", 403);
  }

  if (customer.status !== "ACTIVE") {
    throw new AppError("customer.inactive", 403);
  }

  if (customer.isBlacklisted) {
    throw new AppError("customer.blacklisted", 403);
  }

  if (business && business.isDeleted) {
    throw new AppError("business.deleted", 403);
  }

  return customer;
};

// ======================================================
// 🔐 TOKEN GENERATION
// ======================================================
const generateAuthTokens = (payload) => {
  return signToken(payload);
};

// ======================================================
// 💾 CREATE USER SESSION
// ======================================================
const createUserSession = async ({ userId, refreshToken, tx }) => {
  const client = tx || prisma;

  return client.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
    },
  });
};

// ======================================================
// 💾 CREATE CUSTOMER SESSION
// ======================================================
const createCustomerSession = async ({ customerId, refreshToken, tx }) => {
  const client = tx || prisma;

  return client.refreshToken.create({
    data: {
      token: refreshToken,
      customerId,
      expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
    },
  });
};

// ======================================================
// 🔄 ROTATE USER SESSION
// ======================================================
const rotateUserSession = async ({ refreshToken, tx }) => {
  const client = tx || prisma;

  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  const storedToken = await client.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError("auth.session_invalid", 401);
  }

  const user = await client.user.findUnique({
    where: { id: payload.sub },
    include: { business: true },
  });

  validateUserAccess(user);

  const newTokens = generateAuthTokens({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
    tokenVersion: user.tokenVersion,
  });

  await client.$transaction([
    client.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByToken: newTokens.refreshToken,
      },
    }),
    client.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
      },
    }),
  ]);

  return newTokens;
};

// ======================================================
// 🔄 ROTATE CUSTOMER SESSION
// ======================================================
const rotateCustomerSession = async ({ refreshToken, tx }) => {
  const client = tx || prisma;

  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  const storedToken = await client.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError("auth.session_invalid", 401);
  }

  const customer = await client.customer.findUnique({
    where: { id: payload.sub },
  });

  const business = await client.business.findUnique({
    where: { id: payload.businessId },
  });

  validateCustomerAccess(customer, business);

  const newTokens = generateAuthTokens({
    sub: customer.id,
    identity_type: "customer",
    businessId: customer.businessId,
    role: "CUSTOMER",
    tokenVersion: customer.tokenVersion || 0,
  });

  await client.$transaction([
    client.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByToken: newTokens.refreshToken,
      },
    }),
    client.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        customerId: customer.id,
        expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
      },
    }),
  ]);

  return newTokens;
};

// ======================================================
// 🚫 REVOKE USER SESSIONS
// ======================================================
const revokeUserSessions = async ({ userId, tx }) => {
  const client = tx || prisma;

  await client.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

// ======================================================
// 🚫 REVOKE CUSTOMER SESSIONS
// ======================================================
const revokeCustomerSessions = async ({ customerId, tx }) => {
  const client = tx || prisma;

  await client.refreshToken.updateMany({
    where: {
      customerId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

module.exports = {
  validateUserAccess,
  validateCustomerAccess,
  generateAuthTokens,
  createUserSession,
  createCustomerSession,
  rotateUserSession,
  rotateCustomerSession,
  revokeUserSessions,
  revokeCustomerSessions,
};
