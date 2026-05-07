const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma.js');
const jwtConfig = require('../config/jwt.js');
const AppError = require('../utils/AppError.js');

const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('auth.unauthorized', 401));
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.accessSecret);
  } catch (err) {
    console.log(err);

    return next(new AppError('auth.token_invalid', 401));
  }

  if (!payload.identity_type) {
    return next(new AppError('auth.token_invalid', 401));
  }

  req.auth = {
    id: payload.sub,
    identityType: payload.identity_type,
    role: payload.role || null,
    businessId: payload.businessId || null,
    scope: payload.scope || [],
    tokenVersion: payload.tokenVersion ?? 0, // 🔥 PATCH
  };

  /**
   * =====================================================
   * BUSINESS USER
   * =====================================================
   */
  if (payload.identity_type === 'business') {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        isDeleted: true,
        businessId: true,
        role: true,
        tokenVersion: true, // 🔥 PATCH
        business: {
          select: {
            setupCompleted: true,
            isDeleted: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.isDeleted) {
      return next(new AppError('auth.unauthorized', 401));
    }

    // 🔥 PATCH: SESSION INVALIDATION
    if (user.tokenVersion !== req.auth.tokenVersion) {
      return next(new AppError('auth.session_expired', 401));
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      return next(new AppError('auth.accountLocked', 403));
    }

    if (payload.businessId && user.businessId !== payload.businessId) {
      return next(new AppError('auth.unauthorized', 401));
    }

    if (user.business && user.business.isDeleted) {
      return next(new AppError('business.deleted', 403));
    }

    if (
      user.businessId &&
      user.business &&
      user.business.setupCompleted === false
    ) {
      const allowedPaths = ['/businesses', '/auth/logout'];

      const isAllowed = allowedPaths.some((path) =>
        req.originalUrl.startsWith(path),
      );

      if (!isAllowed) {
        return next(new AppError('business.onboardingRequired', 403));
      }
    }

    req.user = user;

    // 🔥 CONSENT PATCH (BUSINESS USERS ONLY)
    try {
      const consent = await prisma.consent.findFirst({
        where: {
          userId: user.id,
        },
      });

      req.user.hasConsent = !!consent;
    } catch (err) {
      console.log(err);
      req.user.hasConsent = false;
    }

    return next();
  }

  /**
   * =====================================================
   * CUSTOMER
   * =====================================================
   */
  if (payload.identity_type === 'customer') {
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        isDeleted: true,
        businessId: true,
        tokenVersion: true, // 🔥 PATCH
        business: {
          select: {
            isDeleted: true,
          },
        },
      },
    });

    if (!customer || customer.status !== 'ACTIVE' || customer.isDeleted) {
      return next(new AppError('auth.unauthorized', 401));
    }

    // 🔥 PATCH
    if (customer.tokenVersion !== req.auth.tokenVersion) {
      return next(new AppError('auth.session_expired', 401));
    }

    if (customer.lockUntil && customer.lockUntil > new Date()) {
      return next(new AppError('auth.accountLocked', 403));
    }
    if (customer.businessId !== payload.businessId) {
      return next(new AppError('auth.unauthorized', 401));
    }

    if (customer.business && customer.business.isDeleted) {
      return next(new AppError('business.deleted', 403));
    }

    req.auth.customer = customer;
    req.user = customer;

    // 🔥 CONSENT PATCH (CUSTOMERS ONLY)
    try {
      const consent = await prisma.consent.findFirst({
        where: {
          customerId: customer.id,
        },
      });

      req.user.hasConsent = !!consent;
    } catch (err) {
      console.log(err);
      req.user.hasConsent = false;
    }

    return next();
  }

  /**
   * =====================================================
   * SYSTEM ADMIN
   * =====================================================
   */
  if (payload.identity_type === 'system') {
    const admin = await prisma.systemAdmin.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!admin || admin.status !== 'ACTIVE' || admin.isDeleted) {
      return next(new AppError('auth.unauthorized', 401));
    }

    if (admin.tokenVersion !== payload.tokenVersion) {
      return next(new AppError('auth.session_expired', 401));
    }

    req.auth.system = true;

    req.user = {
      id: admin.id,
      role: admin.role.name,
      identityType: 'system',
      permissions: admin.role.rolePermissions.map((rp) => rp.permission.name),
    };

    return next();
  }

  return next(new AppError('auth.unauthorized', 401));
};

module.exports = authMiddleware;
