const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../../../config/prisma");
const { runSeeders } = require("../../../database/seeders/seedManager");
const { seedRegistry } = require("../../../database/seeders/seedRegistry");
const { logAudit } = require("../../../utils/audit.helper");
const coreAuth = require("../../auth/core.auth.service");

const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

/*
|--------------------------------------------------------------------------
| SYSTEM BOOTSTRAP
|--------------------------------------------------------------------------
*/

exports.bootstrapSystemService = async ({ email, password, currency }) => {
  const existing = await prisma.systemSetting.findFirst();

  if (existing && existing.isBootstrapped) {
    throw new Error("System already bootstrapped");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const settings = await tx.systemSetting.create({
      data: {
        currency,
        activePaymentGateway: "SELCOM",
        isBootstrapped: true,
        maxLoginAttempts: 5,
        lockTimeMinutes: 30,
      },
    });

    /**
     * 🔹 STEP 1: CREATE ROLES (CONTROLLED BY ENUM)
     */
    const roles = [
      "SUPER_ADMIN",
      "FINANCE_ADMIN",
      "SECURITY_ADMIN",
      "SUPPORT_ADMIN",
      "OPERATIONS_ADMIN",
      "READ_ONLY_AUDITOR",
    ];

    for (const roleName of roles) {
      await tx.systemAdminRole.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
    }

    /**
     * 🔹 STEP 3: GET SUPER ADMIN ROLE
     */
    const superAdminRole = await tx.systemAdminRole.findUnique({
      where: { name: "SUPER_ADMIN" },
    });

    /**
     * 🔹 STEP 4: CREATE SUPER ADMIN
     */
    const admin = await tx.systemAdmin.create({
      data: {
        email,
        password: hashedPassword,
        roleId: superAdminRole.id, // ✅ NEW
        status: "ACTIVE",
        loginAttempts: 0,
        forcePasswordChange: false,
      },
    });

    await logAudit({
      tx,
      userId: admin.id,
      entityType: "SYSTEM",
      entityId: admin.id,
      action: "SYSTEM_BOOTSTRAPPED",
      module: "ACCESS",
      actorType: "ADMIN",
    });

    return settings;
  });
};

/*
|--------------------------------------------------------------------------
| SYSTEM SEED
|--------------------------------------------------------------------------
*/

exports.runSystemSeed = async () => {
  const results = await runSeeders(seedRegistry);

  return {
    success: true,
    results,
  };
};

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

exports.adminLogin = async ({ email, password, mfaToken }, req) => {
  const settings = await prisma.systemSetting.findFirst();

  const admin = await prisma.systemAdmin.findUnique({
    where: { email },
    include: { role: true }, // ✅ FIX
  });

  const genericError = "Invalid credentials";

  if (!admin) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await logAudit({
      userId: admin?.id || null,
      entityType: "AUTH",
      entityId: email,
      action: "ADMIN_LOGIN_FAILED",
      metadata: { reason: "INVALID_CREDENTIALS" },
      module: "ACCESS",
      actorType: "ADMIN",
    });
    throw new Error(genericError);
  }

  if (admin.lockUntil && admin.lockUntil > new Date()) {
    await logAudit({
      userId: admin?.id || null,
      entityType: "AUTH",
      entityId: email,
      action: "ADMIN_LOGIN_FAILED",
      metadata: { reason: "INVALID_CREDENTIALS" },
      module: "ACCESS",
      actorType: "ADMIN",
    });
    throw new Error("Account temporarily locked");
  }

  const passwordMatch = await bcrypt.compare(password, admin.password);

  /**
   * =====================================================
   * FAILED LOGIN
   * =====================================================
   */
  if (!passwordMatch) {
    const attempts = admin.loginAttempts + 1;

    await prisma.loginActivity.create({
      data: {
        adminId: admin.id,
        status: "FAILED",
        ipAddress: req.ip,
      },
    });

    await securityService.detectLoginAnomaly(admin.id);

    if (attempts >= settings.maxLoginAttempts) {
      const lockUntil = new Date(
        Date.now() + settings.lockTimeMinutes * 60 * 1000,
      );

      await prisma.systemAdmin.update({
        where: { id: admin.id },
        data: {
          loginAttempts: attempts,
          lockUntil,
        },
      });

      throw new Error("Account locked due to failed login attempts");
    }

    await prisma.systemAdmin.update({
      where: { id: admin.id },
      data: { loginAttempts: attempts },
    });

    throw new Error(genericError);
  }

  if (admin.status === "SUSPENDED") {
    throw new Error("Admin account suspended");
  }

  if (admin.mfaEnabled) {
    if (!mfaToken) {
      throw new Error("MFA token required");
    }

    const verified = speakeasy.totp.verify({
      secret: admin.mfaSecret,
      encoding: "base32",
      token: mfaToken,
      window: 1,
    });

    if (!verified) {
      throw new Error("Invalid MFA token");
    }
  }

  await prisma.systemAdmin.update({
    where: { id: admin.id },
    data: {
      loginAttempts: 0,
      lockUntil: null,
    },
  });

  /**
   * =====================================================
   * SUCCESS LOGIN
   * =====================================================
   */

  await prisma.loginActivity.create({
    data: {
      adminId: admin.id,
      status: "SUCCESS",
      ipAddress: req.ip,
    },
  });

  await securityService.detectLoginAnomaly(admin.id);

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: admin.roleId }, // ✅ FIX
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = coreAuth.generateAuthTokens({
    sub: admin.id,
    identity_type: "system",
    role: admin.role?.name || admin.role,
    tokenVersion: admin.tokenVersion,
    permissions,
    businessId: null,
  });

  const accessToken = tokens.accessToken;
  const refreshToken = tokens.refreshToken;

  const rawFingerprint = `${req.ip}-${req.headers["user-agent"]}`;

  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(rawFingerprint)
    .digest("hex");

  const sessions = await prisma.adminSession.findMany({
    where: { adminId: admin.id },
    orderBy: { createdAt: "asc" },
  });

  const MAX_SESSIONS = 3;

  if (sessions.length >= MAX_SESSIONS) {
    const oldestSession = sessions[0];

    await prisma.adminSession.delete({
      where: { id: oldestSession.id },
    });
  }

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      refreshToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      deviceFingerprint,
      lastSeen: new Date(),
    },
  });

  await logAudit({
    userId: admin.id,
    entityType: "AUTH",
    entityId: admin.id,
    action: "ADMIN_LOGIN_SUCCESS",
    metadata: { ip: req.ip },
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return {
    accessToken,
    refreshToken,
    requirePasswordChange: admin.forcePasswordChange,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role.name, // ✅ FIX
      status: admin.status,
    },
  };
};

exports.refreshToken = async ({ refreshToken }) => {
  const session = await prisma.adminSession.findFirst({
    where: { refreshToken },
  });

  if (!session) {
    throw new Error("Invalid session");
  }

  const admin = await prisma.systemAdmin.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || admin.status !== "ACTIVE") {
    await prisma.adminSession.delete({ where: { id: session.id } });
    throw new Error("Session revoked");
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: admin.roleId },
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = coreAuth.generateAuthTokens({
    sub: admin.id,
    identity_type: "system",
    role: admin.role?.name || admin.role,
    tokenVersion: admin.tokenVersion,
    permissions,
    businessId: null,
  });

  await prisma.adminSession.update({
    where: { id: session.id },
    data: {
      refreshToken: tokens.refreshToken,
    },
  });

  await logAudit({
    userId: admin.id,
    entityType: "AUTH",
    entityId: admin.id,
    action: "ADMIN_TOKEN_REFRESHED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return tokens;
};

exports.resetAdminPassword = async (adminId, actor) => {
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const newPassword = crypto.randomBytes(6).toString("hex");

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.systemAdmin.update({
    where: { id: adminId },
    data: {
      password: hashedPassword,
      forcePasswordChange: true,
      tokenVersion: { increment: 1 }, // 🔥 invalidate tokens
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: adminId,
    action: "ADMIN_PASSWORD_RESET",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return {
    newPassword,
  };
};

exports.changePassword = async (adminId, currentPassword, newPassword) => {
  const admin = await prisma.systemAdmin.findUnique({
    where: { id: adminId },
  });

  const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

  if (!passwordMatch) {
    throw new Error("Current password incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 🔥 increment tokenVersion
  const updatedAdmin = await prisma.systemAdmin.update({
    where: { id: adminId },
    data: {
      password: hashedPassword,
      forcePasswordChange: false,
      tokenVersion: { increment: 1 },
    },
  });

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: admin.roleId }, // ✅ FIX
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = coreAuth.generateAuthTokens({
    sub: updatedAdmin.id,
    identity_type: "system",
    role: updatedAdmin.role?.name || updatedAdmin.role,
    tokenVersion: updatedAdmin.tokenVersion,
    permissions,
    businessId: null,
  });

  await logAudit({
    userId: adminId,
    entityType: "ADMIN",
    entityId: adminId,
    action: "ADMIN_PASSWORD_CHANGED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return {
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

/*
|--------------------------------------------------------------------------
| ADMIN MANAGEMENT (FINAL ALIGNED)
|--------------------------------------------------------------------------
*/
exports.createAdmin = async ({ email, password, roleId }, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to create admin");
  }

  const existing = await prisma.systemAdmin.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("Admin already exists");
  }

  const role = await prisma.systemAdminRole.findUnique({
    where: { id: roleId },
  });

  if (!role || !role.isActive) {
    throw new Error("Invalid or inactive role");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.systemAdmin.create({
    data: {
      email,
      password: hashedPassword,
      roleId,
      status: "ACTIVE",
      loginAttempts: 0,
      forcePasswordChange: true,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: created.id,
    action: "ADMIN_CREATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return created;
};

exports.listAdmins = async () => {
  return prisma.systemAdmin.findMany({
    include: {
      role: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.getAdmin = async (id) => {
  const admin = await prisma.systemAdmin.findUnique({
    where: { id },
    include: { role: true },
  });

  if (!admin) throw new Error("Admin not found");

  return admin;
};

exports.updateAdmin = async (id, data, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to update admin");
  }

  if (data.roleId) {
    const role = await prisma.systemAdminRole.findUnique({
      where: { id: data.roleId },
    });

    if (!role || !role.isActive) {
      throw new Error("Invalid role");
    }
  }

  const updated = await prisma.systemAdmin.update({
    where: { id },
    data,
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: id,
    action: "ADMIN_UPDATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.suspendAdmin = async (id, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to suspend admin");
  }

  const admin = await prisma.systemAdmin.findUnique({
    where: { id },
  });

  if (!admin) throw new Error("Admin not found");

  if (admin.status === "SUSPENDED") {
    throw new Error("Admin already suspended");
  }

  // revoke sessions
  await prisma.adminSession.updateMany({
    where: {
      adminId: id,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  const updated = await prisma.systemAdmin.update({
    where: { id },
    data: {
      status: "SUSPENDED",
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: id,
    action: "ADMIN_SUSPENDED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| ROLE ASSIGNMENT
|--------------------------------------------------------------------------
*/

exports.changeAdminRole = async (adminId, roleId, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to change role");
  }

  const role = await prisma.systemAdminRole.findUnique({
    where: { id: roleId },
  });

  if (!role || !role.isActive) {
    throw new Error("Invalid role");
  }

  const updated = await prisma.systemAdmin.update({
    where: { id: adminId },
    data: { roleId },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: adminId,
    action: "ADMIN_ROLE_CHANGED",
    metadata: { roleId },
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT (CONTROLLED)
|--------------------------------------------------------------------------
*/

exports.listRoles = async () => {
  return prisma.systemAdminRole.findMany({
    include: { permissions: true },
    orderBy: { createdAt: "desc" },
  });
};

exports.getRole = async (id) => {
  const role = await prisma.systemAdminRole.findUnique({
    where: { id },
    include: { permissions: true },
  });

  if (!role) throw new Error("Role not found");

  return role;
};

exports.createRoleFromEnum = async (name, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to create role");
  }

  const existing = await prisma.systemAdminRole.findUnique({
    where: { name },
  });

  if (existing) {
    throw new Error("Role already exists");
  }

  const role = await prisma.systemAdminRole.create({
    data: { name },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ROLE",
    entityId: role.id,
    action: "ROLE_CREATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return role;
};

exports.updateRole = async (id, data, actor) => {
  // 🔒 ONLY SUPER_ADMIN
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized to update role");
  }

  const role = await prisma.systemAdminRole.findUnique({
    where: { id },
  });

  if (!role) throw new Error("Role not found");

  if (data.name) {
    const existing = await prisma.systemAdminRole.findUnique({
      where: { name: data.name },
    });

    if (existing && existing.id !== id) {
      throw new Error("Role name already exists");
    }
  }

  const updated = await prisma.systemAdminRole.update({
    where: { id },
    data,
  });

  await logAudit({
    userId: actor.id,
    entityType: "ROLE",
    entityId: id,
    action: "ROLE_UPDATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.activateRole = async (id, actor) => {
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const updated = await prisma.systemAdminRole.update({
    where: { id },
    data: { isActive: true },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ROLE",
    entityId: id,
    action: "ROLE_ACTIVATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.deactivateRole = async (id, actor) => {
  const actorAdmin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
    include: { role: true },
  });

  if (!actorAdmin || actorAdmin.role.name !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const role = await prisma.systemAdminRole.findUnique({
    where: { id },
  });

  if (!role) throw new Error("Role not found");

  if (role.name === "SUPER_ADMIN") {
    throw new Error("Cannot deactivate SUPER_ADMIN role");
  }

  const updated = await prisma.systemAdminRole.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ROLE",
    entityId: id,
    action: "ROLE_DEACTIVATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.setupAdminMFA = async (actor) => {
  const secret = speakeasy.generateSecret();

  await prisma.systemAdmin.update({
    where: { id: actor.id },
    data: {
      mfaSecret: secret.base32,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_MFA_SETUP",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  const qr = await QRCode.toDataURL(secret.otpauth_url);

  return {
    qr,
    secret: secret.base32,
  };
};

exports.verifyAdminMFASetup = async (token, actor) => {
  const admin = await prisma.systemAdmin.findUnique({
    where: { id: actor.id },
  });

  const verified = speakeasy.totp.verify({
    secret: admin.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    throw new Error("Invalid MFA token");
  }

  await prisma.systemAdmin.update({
    where: { id: actor.id },
    data: {
      mfaEnabled: true,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_MFA_VERIFIED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return true;
};

exports.disableAdminMFA = async (actor) => {
  const updated = await prisma.systemAdmin.update({
    where: { id: actor.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_MFA_DISABLED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.getMyProfile = async (actor) => {
  const updated = await prisma.systemAdmin.update({
    where: { id: actor.id },
    data,
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_PROFILE_UPDATED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.updateMyProfile = async (actor, data) => {
  const updated = await prisma.adminSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "SESSION",
    entityId: sessionId,
    action: "ADMIN_SESSION_REVOKED",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.getMySessions = async (actor) => {
  return prisma.adminSession.findMany({
    where: { adminId: actor.id },
    orderBy: { createdAt: "desc" },
  });
};

exports.revokeSession = async (sessionId, actor) => {
  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.adminId !== actor.id) {
    throw new Error("Unauthorized");
  }

  const updated = await prisma.adminSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_REVOKE_SESSION",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};

exports.logoutAdmin = async (actor) => {
  const updated = await prisma.systemAdmin.update({
    where: { id: actor.id },
    data: {
      tokenVersion: { increment: 1 },
    },
  });

  await logAudit({
    userId: actor.id,
    entityType: "ADMIN",
    entityId: actor.id,
    action: "ADMIN_LOGOUT",
    module: "ACCESS",
    actorType: "ADMIN",
  });

  return updated;
};
