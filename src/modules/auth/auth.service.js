const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../../config/prisma");
const jwtConfig = require("../../config/jwt");
const AppError = require("../../utils/AppError");
const { signToken, verifyToken } = require("../../utils/auth.helper");
const notifications = require("../../services/notifications");

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
const login = async ({ email, password }) => {
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("auth.session_invalid", 401);
  }

  return signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
  });
};

/**
 * =====================================================
 * ACCEPT BUSINESS INVITE
 * =====================================================
 */
const acceptInvite = async ({ token, password }) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const invite = await prisma.businessInvite.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!invite) {
    throw new AppError("auth.token_invalid", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      passwordHash,
      role: invite.role,
      status: "ACTIVE",
      emailVerified: true,
      businessId: invite.businessId,
    },
  });

  await prisma.businessInvite.delete({
    where: { id: invite.id },
  });

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
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
 * LOGOUT (STATELESS)
 * =====================================================
 */
const logout = async () => true;

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

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
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

/**
 * =====================================================
 * SYSTEM LOGIN (SUPER ADMIN)
 * =====================================================
 */
const systemLogin = async ({ email, password }) => {
  const admin = await prisma.superAdmin.findFirst({
    where: {
      email,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  if (!admin) {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    throw new AppError("auth.invalid_credentials", 401);
  }

  const tokens = signToken({
    sub: admin.id,
    identity_type: "system",
    role: "SUPER_ADMIN",
  });

  return {
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    tokens,
  };
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
  acceptInvite,
  systemLogin,
};
