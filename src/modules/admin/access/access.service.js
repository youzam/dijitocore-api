const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../../../config/prisma");
const { signToken } = require("../../../utils/auth.helper");

const {
  seedPermissions,
} = require("../../../database/seeders/permissionSeeder");
const {
  assignPermissionsToRoles,
} = require("../../../database/seeders/rolePermissionSeeder");

const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

function generateTokens(admin, permissions) {
  return signToken({
    sub: admin.id,
    identity_type: "system",
    role: admin.role,
    permissions,
    businessId: null,
  });
}

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

    const admin = await tx.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        loginAttempts: 0,
        forcePasswordChange: false,
      },
    });

    await seedPermissions(tx);
    await assignPermissionsToRoles(tx);

    await tx.auditLog.create({
      data: {
        action: "SYSTEM_BOOTSTRAP",
        entityType: "System",
        entityId: settings.id,
        meta: {
          createdAdmin: admin.email,
        },
      },
    });

    return settings;
  });
};

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

exports.adminLogin = async ({ email, password, mfaToken }, req) => {
  const settings = await prisma.systemSetting.findFirst();

  const admin = await prisma.superAdmin.findUnique({
    where: { email },
  });

  const genericError = "Invalid credentials";

  if (!admin) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    throw new Error(genericError);
  }

  if (admin.lockUntil && admin.lockUntil > new Date()) {
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

    // 🔥 LOGIN ACTIVITY
    await prisma.loginActivity.create({
      data: {
        adminId: admin.id,
        status: "FAILED",
        ipAddress: req.ip,
      },
    });

    // 🔥 DETECT ANOMALY
    await securityService.detectLoginAnomaly(admin.id);

    if (attempts >= settings.maxLoginAttempts) {
      const lockUntil = new Date(
        Date.now() + settings.lockTimeMinutes * 60 * 1000,
      );

      await prisma.superAdmin.update({
        where: { id: admin.id },
        data: {
          loginAttempts: attempts,
          lockUntil,
        },
      });

      throw new Error("Account locked due to failed login attempts");
    }

    await prisma.superAdmin.update({
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

  await prisma.superAdmin.update({
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

  // 🔥 LOGIN ACTIVITY
  await prisma.loginActivity.create({
    data: {
      adminId: admin.id,
      status: "SUCCESS",
      ipAddress: req.ip,
    },
  });

  // 🔥 DETECT ANOMALY
  await securityService.detectLoginAnomaly(admin.id);

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: admin.role },
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = signToken({
    sub: admin.id,
    identity_type: "system",
    role: admin.role,
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

  return {
    accessToken,
    refreshToken,
    requirePasswordChange: admin.forcePasswordChange,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
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

  const admin = await prisma.superAdmin.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || admin.status !== "ACTIVE") {
    await prisma.adminSession.delete({ where: { id: session.id } });
    throw new Error("Session revoked");
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: admin.role },
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = generateTokens(admin, permissions);

  await prisma.adminSession.update({
    where: { id: session.id },
    data: {
      refreshToken: tokens.refreshToken,
    },
  });

  return tokens;
};

exports.changePassword = async (adminId, currentPassword, newPassword) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

  if (!passwordMatch) {
    throw new Error("Current password incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      password: hashedPassword,
      forcePasswordChange: false,
    },
  });

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: admin.role },
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  const tokens = generateTokens(admin, permissions);

  return {
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};
