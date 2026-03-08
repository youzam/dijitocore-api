const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../../../config/prisma");
const {
  seedPermissions,
} = require("../../../database/seeders/permissionSeeder");
const {
  assignPermissionsToRoles,
} = require("../../../database/seeders/rolePermissionSeeder");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

function generateTokens(admin, permissions) {
  const accessToken = jwt.sign(
    {
      id: admin.id,
      role: admin.role,
      permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  return { accessToken, refreshToken };
}

function generateFingerprint(req) {
  const raw = `${req.ip}-${req.headers["user-agent"]}`;

  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function enforceSessionLimit(adminId) {
  const sessions = await prisma.adminSession.findMany({
    where: { adminId },
    orderBy: { createdAt: "asc" },
  });

  const MAX_SESSIONS = 3;

  if (sessions.length >= MAX_SESSIONS) {
    const oldestSession = sessions[0];

    await prisma.adminSession.delete({
      where: { id: oldestSession.id },
    });
  }
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

    /*
    |--------------------------------------------------------------------------
    | Seed permissions inside transaction
    |--------------------------------------------------------------------------
    */

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
exports.setupAdminMFA = async (adminId) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  const secret = speakeasy.generateSecret({
    length: 20,
    name: `AdminPortal:${admin.email}`,
  });

  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      mfaSecret: secret.base32,
    },
  });

  return {
    qrCode,
    secret: secret.base32,
  };
};

exports.verifyAdminMFASetup = async (adminId, token) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin || !admin.mfaSecret) {
    throw new Error("MFA setup not initiated");
  }

  const verified = speakeasy.totp.verify({
    secret: admin.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    throw new Error("Invalid MFA token");
  }

  await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      mfaEnabled: true,
    },
  });

  return { success: true };
};

exports.disableAdminMFA = async (adminId, token) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin.mfaEnabled) {
    throw new Error("MFA not enabled");
  }

  const verified = speakeasy.totp.verify({
    secret: admin.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    throw new Error("Invalid MFA token");
  }

  await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  return { success: true };
};

exports.adminLogin = async ({ email, password, mfaToken }, req) => {
  const settings = await prisma.systemSetting.findFirst();

  /*
  |--------------------------------------------------------------------------
  | LOAD ADMIN
  |--------------------------------------------------------------------------
  */

  const admin = await prisma.superAdmin.findUnique({
    where: { email },
  });

  /*
  |--------------------------------------------------------------------------
  | PREVENT USER ENUMERATION
  |--------------------------------------------------------------------------
  */

  const genericError = "Invalid credentials";

  if (!admin) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    throw new Error(genericError);
  }

  /*
  |--------------------------------------------------------------------------
  | ACCOUNT LOCK CHECK
  |--------------------------------------------------------------------------
  */

  if (admin.lockUntil && admin.lockUntil > new Date()) {
    throw new Error("Account temporarily locked");
  }

  /*
  |--------------------------------------------------------------------------
  | PASSWORD CHECK
  |--------------------------------------------------------------------------
  */

  const passwordMatch = await bcrypt.compare(password, admin.password);

  if (!passwordMatch) {
    const attempts = admin.loginAttempts + 1;

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

  /*
  |--------------------------------------------------------------------------
  | ACCOUNT STATUS
  |--------------------------------------------------------------------------
  */

  if (admin.status === "SUSPENDED") {
    throw new Error("Admin account suspended");
  }

  /*
  |--------------------------------------------------------------------------
  | MFA CHECK
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | RESET LOGIN ATTEMPTS
  |--------------------------------------------------------------------------
  */

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: {
      loginAttempts: 0,
      lockUntil: null,
    },
  });

  /*
  |--------------------------------------------------------------------------
  | LOAD ROLE PERMISSIONS
  |--------------------------------------------------------------------------
  */

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: admin.role },
    include: { permission: true },
  });

  const permissions = rolePermissions.map(
    (p) =>
      `${p.permission.module}_${p.permission.action}_${p.permission.scope}`,
  );

  /*
  |--------------------------------------------------------------------------
  | GENERATE TOKENS
  |--------------------------------------------------------------------------
  */

  const accessToken = jwt.sign(
    {
      id: admin.id,
      role: admin.role,
      permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  /*
  |--------------------------------------------------------------------------
  | DEVICE FINGERPRINT
  |--------------------------------------------------------------------------
  */

  const rawFingerprint = `${req.ip}-${req.headers["user-agent"]}`;

  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(rawFingerprint)
    .digest("hex");

  /*
  |--------------------------------------------------------------------------
  | SESSION LIMIT
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | CREATE SESSION
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

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

exports.logoutAdmin = async (refreshToken) => {
  const session = await prisma.adminSession.findFirst({
    where: { refreshToken },
  });

  if (!session) {
    return { success: true };
  }

  await prisma.adminSession.delete({
    where: { id: session.id },
  });

  return { success: true };
};

/*
|--------------------------------------------------------------------------
| ADMIN MANAGEMENT
|--------------------------------------------------------------------------
*/

exports.createAdmin = async ({ email, password, role }) => {
  const existing = await prisma.superAdmin.findFirst({
    where: { email },
  });

  if (existing) {
    throw new Error("Admin email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.superAdmin.create({
    data: {
      email,
      password: hashedPassword,
      role,
      status: "ACTIVE",
      loginAttempts: 0,
      forcePasswordChange: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_CREATED",
      entityType: "SuperAdmin",
      entityId: admin.id,
    },
  });

  return admin;
};

exports.listAdmins = async () => {
  return prisma.superAdmin.findMany({
    orderBy: { createdAt: "desc" },
  });
};

exports.getAdmin = async (adminId) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  return admin;
};

exports.updateAdmin = async (adminId, data) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  return prisma.superAdmin.update({
    where: { id: adminId },
    data,
  });
};

exports.suspendAdmin = async (adminId) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  const updated = await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      status: "SUSPENDED",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_SUSPENDED",
      entityType: "SuperAdmin",
      entityId: adminId,
    },
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| ROLES
|--------------------------------------------------------------------------
*/

exports.listRoles = async () => {
  return [
    "SUPER_ADMIN",
    "FINANCE_ADMIN",
    "SUPPORT_ADMIN",
    "SECURITY_ADMIN",
    "OPERATIONS_ADMIN",
    "READ_ONLY_AUDITOR",
  ];
};

exports.changeAdminRole = async (adminId, role) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  return prisma.superAdmin.update({
    where: { id: adminId },
    data: { role },
  });
};

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

exports.getMyProfile = async (adminId) => {
  const admin = await prisma.superAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  return admin;
};

exports.updateMyProfile = async (adminId, data) => {
  return prisma.superAdmin.update({
    where: { id: adminId },
    data,
  });
};

/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

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

  return { success: true };
};

exports.resetAdminPassword = async (adminId, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.superAdmin.update({
    where: { id: adminId },
    data: {
      password: hashedPassword,
      forcePasswordChange: true,
      loginAttempts: 0,
      lockUntil: null,
    },
  });

  return { success: true };
};

/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

exports.getMySessions = async (adminId) => {
  return prisma.adminSession.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
  });
};

exports.revokeSession = async (sessionId) => {
  await prisma.adminSession.delete({
    where: { id: sessionId },
  });

  return { success: true };
};
