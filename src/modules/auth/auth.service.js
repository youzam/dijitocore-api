const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../../config/prisma");
const jwtConfig = require("../../config/jwt");
const AppError = require("../../utils/AppError");
const { signToken, verifyToken } = require("../../utils/auth.helper");
const notifications = require("../../services/notifications");
const { logAudit } = require("../../utils/audit.helper");

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

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    tokens,
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
  });

  if (!user) {
    await logAudit({
      businessId: null,
      userId: null,
      entityType: "AUTH",
      entityId: email,
      action: "LOGIN_FAILED",
      metadata: {
        reason: "INVALID_CREDENTIALS",
      },
    });
    throw new AppError("auth.invalid_credentials", 401);
  }

  // ✅ Load security config from SystemSetting
  const systemSetting = await prisma.systemSetting.findUnique({
    where: { id: "SYSTEM" },
    select: {
      maxLoginAttempts: true,
      lockTimeMinutes: true,
    },
  });

  const MAX_ATTEMPTS = systemSetting?.maxLoginAttempts || 5;
  const LOCK_TIME_MS = (systemSetting?.lockTimeMinutes || 15) * 60 * 1000;

  // 🔒 Check if account locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError("auth.account_locked", 423);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  /**
   * =====================================================
   * FAILED LOGIN
   * =====================================================
   */
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;

    // 🔥 LOGIN ACTIVITY
    await prisma.loginActivity.create({
      data: {
        userId: user.id,
        status: "FAILED",
        ipAddress: req.ip,
      },
    });

    // 🔥 DETECT ANOMALY
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
      metadata: {
        reason: "INVALID_CREDENTIALS",
      },
    });

    throw new AppError("auth.invalid_credentials", 401);
  }

  if (user.status !== "ACTIVE") {
    await logAudit({
      businessId: null,
      userId: null,
      entityType: "AUTH",
      entityId: email,
      action: "LOGIN_FAILED",
      metadata: {
        reason: "INVALID_CREDENTIALS",
      },
    });
    throw new AppError("auth.invalid_credentials", 401);
  }

  // ✅ Reset failed attempts after successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    },
  });

  /**
   * =====================================================
   * SUCCESS LOGIN
   * =====================================================
   */

  // 🔥 LOGIN ACTIVITY
  await prisma.loginActivity.create({
    data: {
      userId: user.id,
      status: "SUCCESS",
      ipAddress: req.ip,
    },
  });

  // 🔥 DETECT ANOMALY
  await securityService.detectLoginAnomaly(user.id);

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });

  // ✅ Store refresh token
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
    },
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
  const payload = verifyToken(refreshToken, jwtConfig.refreshSecret);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError("auth.session_invalid", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("auth.session_invalid", 401);
  }

  const newTokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByToken: newTokens.refreshToken,
      },
    }),
    prisma.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + jwtConfig.refreshExpiresInMs),
      },
    }),
  ]);

  return newTokens;
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
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user || user.status !== "ACTIVE" || !user.emailVerified) return;

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetHash,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  await notifications.sendPasswordReset({
    to: user.email,
    locale: user.locale || "en",
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
  });

  if (!user) throw new AppError("auth.token_invalid", 400);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  await revokeAllUserSessions(user.id);

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
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

/**
 * =====================================================
 * CUSTOMER AUTH
 * =====================================================
 */
const customerIdentify = async (phone) => {
  const customers = await prisma.customer.findMany({
    where: { phone },
    select: {
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return customers.map((c) => ({
    businessId: c.business.id,
    business_name: c.business.name,
  }));
};

const customerRequestOtp = async (phone, businessId) => {
  const customer = await prisma.customer.findFirst({
    where: {
      phone,
      businessId,
      status: "ACTIVE",
    },
  });

  if (!customer) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  await notifications.sendOtp({
    to: customer.phone,
    otp,
  });
};

const customerVerifyOtp = async (phone, businessId, otp) => {
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const customer = await prisma.customer.findFirst({
    where: {
      phone,
      businessId,
      otpHash,
      otpExpiresAt: { gt: new Date() },
      status: "ACTIVE",
    },
  });

  if (!customer) throw new AppError("auth.invalid_otp", 401);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      lastLoginAt: new Date(),
    },
  });

  const tokens = signToken({
    sub: customer.id,
    identity_type: "customer",
    businessId,
    scope: ["portal.read"],
  });

  return {
    customer: {
      id: customer.id,
      phone: customer.phone,
      businessId,
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
  customerIdentify,
  customerRequestOtp,
  customerVerifyOtp,
  verifyEmail,
};
