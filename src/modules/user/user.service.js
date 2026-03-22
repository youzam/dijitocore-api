const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const notifications = require("../../services/notifications");
const { signToken } = require("../../utils/auth.helper");
const subscriptionAuthority = require("../subscription/subscription.authority.service");

// =====================================================
// 🔹 INVITE USER
// =====================================================
exports.inviteUser = async (owner, payload) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  const { email, role } = payload;

  await subscriptionAuthority.assertFeature(owner.businessId, "allowMultiUser");

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

  return { invited: true, email, role };
};

// =====================================================
// 🔹 ACCEPT INVITE
// =====================================================
exports.acceptInvite = async ({ token, password }) => {
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

  const existingUser = await prisma.user.findFirst({
    where: {
      email: invite.email,
      businessId: invite.businessId,
    },
  });

  if (existingUser) {
    throw new AppError("user.already_exists", 400);
  }

  await subscriptionAuthority.assertActiveSubscription(invite.businessId);

  await subscriptionAuthority.assertFeature(
    invite.businessId,
    "allowMultiUser",
  );

  // 🔥 FIXED (NO MANUAL COUNT)
  await subscriptionAuthority.assertLimit(invite.businessId, "maxUsers");

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

// =====================================================
// 🔹 INVITES MANAGEMENT
// =====================================================
exports.listInvites = async (owner) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  return prisma.businessInvite.findMany({
    where: { businessId: owner.businessId },
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

exports.revokeInvite = async (owner, inviteId) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  return prisma.businessInvite.delete({
    where: {
      id: inviteId,
      businessId: owner.businessId,
    },
  });
};

// =====================================================
// 🔹 USERS MANAGEMENT
// =====================================================
exports.listUsers = async (owner) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  return prisma.user.findMany({
    where: { businessId: owner.businessId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

exports.updateUser = async (owner, userId, payload) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      businessId: owner.businessId,
    },
  });

  if (!user) {
    throw new AppError("user.not_found", 404);
  }

  return prisma.user.update({
    where: { id: userId },
    data: payload,
  });
};

exports.activateUser = async (owner, userId) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      businessId: owner.businessId,
    },
  });

  if (!user) {
    throw new AppError("user.not_found", 404);
  }

  if (owner.id === userId) {
    throw new AppError("user.self_action_not_allowed", 400);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });
};

exports.deactivateUser = async (owner, userId) => {
  if (owner.role !== "BUSINESS_OWNER") {
    throw new AppError("auth.forbidden", 403);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      businessId: owner.businessId,
    },
  });

  if (!user) {
    throw new AppError("user.not_found", 404);
  }

  if (owner.id === userId) {
    throw new AppError("user.self_action_not_allowed", 400);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
};
