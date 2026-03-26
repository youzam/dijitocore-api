const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const { signToken } = require("../../utils/auth.helper");
const notifications = require("../../services/notifications");
const { logAudit } = require("../../utils/audit.helper");
const coreAuth = require("./core.auth.service");

/**
 * OWNER SIGNUP (NO JWT – SEND 6 DIGIT CODE)
 */
const ownerSignup = async ({ email, password }) => {
  const existing = await prisma.user.findFirst({ where: { email } });

  if (existing) {
    throw new AppError("auth.email_exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

  const verifyHash = crypto
    .createHash("sha256")
    .update(verifyCode)
    .digest("hex");

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "BUSINESS_OWNER",
      status: "PENDING",
      emailVerified: false,
      emailVerifyToken: verifyHash,
      emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await notifications.sendEmailVerification({
    to: email,
    code: verifyCode,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "USER_SIGNUP",
  });

  return {};
};

/**
 * VERIFY EMAIL VIA 6 DIGIT CODE → ISSUE JWT
 */
const verifyEmail = async (code) => {
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: hash,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("auth.token_invalid", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      status: "ACTIVE",
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "EMAIL_VERIFIED",
  });

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: null,
  });

  // 🔥 PATCH — CONSENT CHECK
  const existingConsent = await prisma.consent.findFirst({
    where: {
      userId: user.id,
    },
  });

  const forceConsent = !existingConsent;

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    tokens,
    forceConsent,
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
      entityType: "AUTH",
      entityId: email,
      action: "LOGIN_FAILED",
      metadata: { reason: "INVALID_CREDENTIALS" },
    });

    throw new AppError("auth.invalid_credentials", 401);
  }

  // 🔥 CORE VALIDATION
  coreAuth.validateUserAccess(user);

  const systemSetting = await prisma.systemSetting.findUnique({
    where: { id: "SYSTEM" },
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
        status: "FAILED",
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
      entityType: "AUTH",
      entityId: email,
      action: "LOGIN_FAILED",
      metadata: { reason: "INVALID_CREDENTIALS" },
    });

    throw new AppError("auth.invalid_credentials", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("auth.invalid_credentials", 401);
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
      status: "SUCCESS",
      ipAddress: req.ip,
    },
  });

  await securityService.detectLoginAnomaly(user.id);

  // 🔥 CORE TOKEN
  const tokens = coreAuth.generateAuthTokens({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });

  // 🔥 CORE SESSION
  await coreAuth.createUserSession({
    userId: user.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "LOGIN_SUCCESS",
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    tokens,
  };
};

/**
 * =====================================================
 * REFRESH TOKEN
 * =====================================================
 */
const refresh = async (refreshToken) => {
  // 🔥 CORE handles:
  // - token verification
  // - session validation
  // - user validation (isDeleted, lockUntil, etc.)
  // - rotation (revoke old + create new)
  const tokens = await coreAuth.rotateUserSession({
    refreshToken,
  });

  return tokens;
};
/**
 * =====================================================
 * LOGOUT
 * =====================================================
 */
const logout = async (auth) => {
  if (!auth || !auth.refreshToken) return true;

  await prisma.refreshToken.updateMany({
    where: {
      token: auth.refreshToken,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "LOGOUT",
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

  const resetToken = crypto.randomBytes(32).toString("hex");

  const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashed,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // 🔥 BUILD URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // 🔥 REAL FUNCTION FROM YOUR SYSTEM
  await notificationService.sendPasswordReset({
    to: user.email,
    locale: "en",
    resetUrl,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
  });
};

const resetPassword = async (token, newPassword) => {
  const hashed = crypto.createHash("sha256").update(token).digest("hex");

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
    throw new AppError("auth.token_invalid", 400);
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

  // 🔥 CORE TOKEN GENERATION
  const tokens = coreAuth.generateAuthTokens({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });

  // 🔥 CREATE NEW SESSION
  await coreAuth.createUserSession({
    userId: user.id,
    refreshToken: tokens.refreshToken,
  });

  await logAudit({
    businessId: user.businessId,
    userId: user.id,
    entityType: "AUTH",
    entityId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    tokens,
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
