const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const notifications = require("../../services/notifications");
const { signToken } = require("../../utils/auth.helper");
const subscriptionAuthority = require("../subscription/subscription.authority.service");
const auditHelper = require("../../utils/audit.helper");

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

  await auditHelper.logAudit({
    businessId: owner.businessId,
    entityType: "USER_INVITE",
    entityId: email,
    action: "USER_INVITED",
    metadata: {
      email,
      role,
      invitedBy: owner.id,
    },
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

  await auditHelper.logAudit({
    businessId: user.businessId,
    entityType: "USER",
    entityId: user.id,
    action: "USER_CREATED_FROM_INVITE",
    metadata: {
      email: user.email,
      role: user.role,
    },
  });

  const tokens = signToken({
    sub: user.id,
    identity_type: "business",
    role: user.role,
    businessId: user.businessId,
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
      businessId: user.businessId,
    },
    tokens,
    forceConsent,
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

  const invite = await prisma.businessInvite.findFirst({
    where: {
      id: inviteId,
      businessId: owner.businessId,
    },
  });

  if (!invite) {
    throw new AppError("invite.not_found", 404);
  }

  await prisma.businessInvite.delete({
    where: { id: inviteId },
  });

  await auditHelper.logAudit({
    businessId: owner.businessId,
    entityType: "USER_INVITE",
    entityId: inviteId,
    action: "INVITE_REVOKED",
    metadata: {
      email: invite.email,
      role: invite.role,
      revokedBy: owner.id,
    },
  });

  return { revoked: true };
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: payload,
  });

  await auditHelper.logAudit({
    businessId: owner.businessId,
    entityType: "USER",
    entityId: userId,
    action: "USER_UPDATED",
    metadata: {
      updatedBy: owner.id,
      changes: payload,
    },
  });

  return updated;
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });

  await auditHelper.logAudit({
    businessId: owner.businessId,
    entityType: "USER",
    entityId: userId,
    action: "USER_ACTIVATED",
    metadata: {
      activatedBy: owner.id,
    },
  });

  return updated;
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });

  await auditHelper.logAudit({
    businessId: owner.businessId,
    entityType: "USER",
    entityId: userId,
    action: "USER_SUSPENDED",
    metadata: {
      suspendedBy: owner.id,
    },
  });

  return updated;
};
