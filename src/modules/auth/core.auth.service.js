const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const jwtConfig = require('../../config/jwt');
const { signToken, verifyToken } = require('../../utils/auth.helper');

const validateUserAccess = (user) => {
  if (!user) throw new AppError('auth.unauthorized', 401);
  if (user.isDeleted) throw new AppError('auth.account_deleted', 403);
  if (user.status !== 'ACTIVE')
    throw new AppError('auth.account_inactive', 403);
  if (!user.emailVerified) throw new AppError('auth.email_not_verified', 403);

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError('auth.account_locked', 423);
  }

  if (user.business && user.business.isDeleted) {
    throw new AppError('business.deleted', 403);
  }

  return user;
};

const validateCustomerAccess = (customer, business) => {
  if (!customer) throw new AppError('auth.unauthorized', 401);
  if (customer.isDeleted) throw new AppError('auth.account_deleted', 403);
  if (customer.status !== 'ACTIVE')
    throw new AppError('customer.inactive', 403);
  if (customer.isBlacklisted) throw new AppError('customer.blacklisted', 403);

  if (business && business.isDeleted) {
    throw new AppError('business.deleted', 403);
  }

  return customer;
};

const generateAuthTokens = (payload) => signToken(payload);

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

const rotateUserSession = async ({ refreshToken, tx }) => {
  const client = tx || prisma;
  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  const storedToken = await client.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (
    !storedToken ||
    !storedToken.userId ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError('auth.session_invalid', 401);
  }

  const user = await client.user.findUnique({
    where: { id: payload.sub },
    include: { business: true },
  });

  validateUserAccess(user);

  if (user.id !== storedToken.userId) {
    throw new AppError('auth.session_invalid', 401);
  }

  if (user.tokenVersion !== (payload.tokenVersion ?? 0)) {
    throw new AppError('auth.session_expired', 401);
  }

  const newTokens = generateAuthTokens({
    sub: user.id,
    identity_type: 'business',
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

const rotateCustomerSession = async ({ refreshToken, tx }) => {
  const client = tx || prisma;
  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  const storedToken = await client.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (
    !storedToken ||
    !storedToken.customerId ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError('auth.session_invalid', 401);
  }

  const customer = await client.customer.findUnique({
    where: { id: payload.sub },
    include: { business: true },
  });

  validateCustomerAccess(customer, customer?.business);

  if (customer.id !== storedToken.customerId) {
    throw new AppError('auth.session_invalid', 401);
  }

  if (customer.tokenVersion !== (payload.tokenVersion ?? 0)) {
    throw new AppError('auth.session_expired', 401);
  }

  const newTokens = generateAuthTokens({
    sub: customer.id,
    identity_type: 'customer',
    businessId: customer.businessId,
    role: 'CUSTOMER',
    tokenVersion: customer.tokenVersion,
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

const revokeUserSessions = async ({ userId, tx }) => {
  const client = tx || prisma;

  return client.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

const revokeCustomerSessions = async ({ customerId, tx }) => {
  const client = tx || prisma;

  return client.refreshToken.updateMany({
    where: {
      customerId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

const rotateSession = async ({ refreshToken, tx }) => {
  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  if (payload.identity_type === 'customer') {
    return rotateCustomerSession({
      refreshToken,
      tx,
    });
  }

  return rotateUserSession({
    refreshToken,
    tx,
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
  rotateSession,
  revokeUserSessions,
  revokeCustomerSessions,
};
