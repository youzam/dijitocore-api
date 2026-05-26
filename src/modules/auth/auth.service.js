const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const notifications = require('../../services/notifications');
const { logAudit } = require('../../utils/audit.helper');
const coreAuth = require('./core.auth.service');
const securityService = require('../admin/security/security.service');
const notificationService = require('../../services/notifications/notification.service');
const env = require('../../config/env');
const privacyService = require('../privacy/privacy.service');

/**
 * OWNER SIGNUP (NO JWT – SEND 6 DIGIT CODE)
 */

const ownerSignup = async (
  {
    email,
    name,
    password,
    packageId,
    billingCycle,
    acceptedTerms,
    acceptedPrivacy,
  },
  req,
) => {
  const existing = await prisma.user.findFirst({ where: { email } });

  if (existing) {
    throw new AppError('auth.email_exists', 409);
  }

  const pkg = await prisma.subscriptionPackage.findFirst({
    where: {
      id: packageId,
      isActive: true,
      isDeleted: false,
    },
  });

  if (!pkg) {
    throw new AppError('subscription.package_not_available', 404);
  }

  if (billingCycle === 'YEARLY' && !pkg.priceYearly) {
    throw new AppError('subscription.yearly_not_available', 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

  const verifyHash = crypto
    .createHash('sha256')
    .update(verifyCode)
    .digest('hex');

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'BUSINESS_OWNER',
        status: 'PENDING',
        emailVerified: false,
        emailVerifyToken: verifyHash,
        emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await tx.userOnboarding.create({
      data: {
        userId: createdUser.id,
        packageId,
        billingCycle,
        step: 'SIGNUP_STARTED',
      },
    });

    await privacyService.acceptTermsAndPrivacy({
      actorType: 'USER',
      userId: createdUser.id,
      businessId: null,
      source: 'SIGNUP',
      metadata: {
        acceptedTerms,
        acceptedPrivacy,
        packageId,
        billingCycle,
      },
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      deviceId: req?.headers?.['x-device-id'] || null,
    });

    return createdUser;
  });

  await notifications.sendEmailVerification({
    to: email,
    code: verifyCode,
  });

  await logAudit({
    businessId: null,
    userId: user.id,
    entityType: 'AUTH',
    entityId: user.id,
    action: 'USER_SIGNUP',
    metadata: {
      packageId,
      billingCycle,
    },
  });

  return {
    onboarding: {
      step: 'SIGNUP_STARTED',
      packageId,
      billingCycle,
      emailVerificationRequired: true,
    },
  };
};

const verifyEmail = async (code) => {
  const hash = crypto.createHash('sha256').update(code).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: hash,
      emailVerifyExpires: { gt: new Date() },
    },
    include: {
      onboarding: {
        include: {
          package: {
            select: {
              id: true,
              name: true,
              code: true,
              priceMonthly: true,
              priceYearly: true,
              setupFee: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('auth.token_invalid', 400);
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const verifiedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    if (user.onboarding) {
      await tx.userOnboarding.update({
        where: { userId: user.id },
        data: {
          step: 'EMAIL_VERIFIED',
        },
      });
    }

    return verifiedUser;
  });

  const tokens = coreAuth.generateAuthTokens({
    sub: updatedUser.id,
    identity_type: 'business',
    role: updatedUser.role,
    businessId: updatedUser.businessId,
    tokenVersion: updatedUser.tokenVersion,
  });

  await coreAuth.createUserSession({
    userId: updatedUser.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: updatedUser.businessId,
    userId: updatedUser.id,
    entityType: 'AUTH',
    entityId: updatedUser.id,
    action: 'EMAIL_VERIFIED',
  });

  const forceConsent = !(await privacyService.hasAcceptedLatestTermsAndPrivacy({
    actorType: 'USER',
    userId: updatedUser.id,
  }));

  return {
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      businessId: updatedUser.businessId,
    },
    tokens,
    forceConsent,
    onboarding: {
      step: 'EMAIL_VERIFIED',
      nextStep: user.onboarding ? 'CREATE_BUSINESS' : 'SELECT_PACKAGE',
      packageId: user.onboarding?.packageId || null,
      billingCycle: user.onboarding?.billingCycle || null,
      package: user.onboarding?.package || null,
    },
  };
};

/**
 * =====================================================
 * LOGIN (BUSINESS USERS)
 * =====================================================
 */
const login = async ({ email, password }, req) => {
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      business: true,
    },
  });

  if (!user) {
    await logAudit({
      businessId: null,
      userId: null,
      entityType: 'AUTH',
      entityId: email,
      action: 'LOGIN_FAILED',
      metadata: { reason: 'INVALID_CREDENTIALS' },
    });

    throw new AppError('auth.invalid_credentials', 401);
  }

  // 🔥 CORE VALIDATION
  coreAuth.validateUserAccess(user);

  const systemSetting = await prisma.systemSetting.findUnique({
    where: { id: 'SYSTEM' },
    select: {
      maxLoginAttempts: true,
      lockTimeMinutes: true,
    },
  });

  const MAX_ATTEMPTS = systemSetting?.maxLoginAttempts || 5;
  const LOCK_TIME_MS = (systemSetting?.lockTimeMinutes || 15) * 60 * 1000;

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;

    await prisma.loginActivity.create({
      data: {
        userId: user.id,
        status: 'FAILED',
        ipAddress: req.ip,
      },
    });

    await securityService.detectLoginAnomaly(user.id);

    const updateData = {
      failedLoginAttempts: attempts,
    };

    if (attempts >= MAX_ATTEMPTS) {
      updateData.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await logAudit({
      businessId: null,
      userId: null,
      entityType: 'AUTH',
      entityId: email,
      action: 'LOGIN_FAILED',
      metadata: { reason: 'INVALID_CREDENTIALS' },
    });

    throw new AppError('auth.invalid_credentials', 401);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('auth.invalid_credentials', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await prisma.loginActivity.create({
    data: {
      userId: user.id,
      status: 'SUCCESS',
      ipAddress: req.ip,
    },
  });

  await securityService.detectLoginAnomaly(user.id);

  // 🔥 CORE TOKEN
  const tokens = coreAuth.generateAuthTokens({
    sub: user.id,
    identity_type: 'business',
    role: user.role,
    businessId: user.businessId,
    tokenVersion: user.tokenVersion,
  });

  // 🔥 CORE SESSION
  await coreAuth.createUserSession({
    userId: user.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: 'AUTH',
    entityId: user.id,
    action: 'LOGIN_SUCCESS',
  });

  const forceConsent = !(await privacyService.hasAcceptedLatestTermsAndPrivacy({
    actorType: 'USER',
    userId: user.id,
  }));

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    tokens,
    forceConsent,
  };
};

/**
 * =====================================================
 * REFRESH TOKEN
 * =====================================================
 */
const refresh = async (refreshToken) => {
  return coreAuth.rotateSession({
    refreshToken,
  });
};
/**
 * =====================================================
 * LOGOUT
 * =====================================================
 */
const logout = async (auth, refreshToken) => {
  if (!auth) return true;

  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  } else if (auth.identityType === 'customer') {
    await coreAuth.revokeCustomerSessions({ customerId: auth.id });
  } else {
    await coreAuth.revokeUserSessions({ userId: auth.id });
  }

  await logAudit({
    businessId: auth.businessId || null,
    userId: auth.identityType === 'business' ? auth.id : null,
    customerId: auth.identityType === 'customer' ? auth.id : null,
    entityType: 'AUTH',
    entityId: auth.id,
    action: 'LOGOUT',
  });

  return true;
};

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
const requestPasswordReset = async (email) => {
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      business: true,
    },
  });

  if (!user) {
    return;
  }

  coreAuth.validateUserAccess(user);

  const resetToken = crypto.randomBytes(32).toString('hex');

  const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashed,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // 🔥 BUILD URL
  const resetUrl = `${env.frontend.url}/auth/password/reset?token=${resetToken}`;

  // 🔥 REAL FUNCTION FROM YOUR SYSTEM
  await notificationService.sendPasswordReset({
    to: user.email,
    locale: 'en',
    resetUrl,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: 'AUTH',
    entityId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
  });
};

const resetPassword = async (token, newPassword) => {
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashed,
      passwordResetExpires: { gt: new Date() },
    },
    include: {
      business: true,
    },
  });

  if (!user) {
    throw new AppError('auth.token_invalid', 400);
  }

  // 🔥 CORE VALIDATION
  coreAuth.validateUserAccess(user);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // 🔥 CORE SESSION REVOKE
  await coreAuth.revokeUserSessions({
    userId: user.id,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: 'AUTH',
    entityId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
  };
};

const revokeAllUserSessions = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

module.exports = {
  ownerSignup,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  revokeAllUserSessions,
};
