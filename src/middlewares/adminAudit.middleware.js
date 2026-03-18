const prisma = require("../config/prisma");

/*
|--------------------------------------------------------------------------
| Extract Entity ID
|--------------------------------------------------------------------------
*/

function extractEntityId(req) {
  if (req.params && req.params.id) {
    return String(req.params.id);
  }

  if (req.body && req.body.id) {
    return String(req.body.id);
  }

  return "N/A";
}

/*
|--------------------------------------------------------------------------
| Detect Admin Action
|--------------------------------------------------------------------------
*/

function detectAction(req) {
  const { method, originalUrl } = req;

  const url = originalUrl.toLowerCase();

  if (method === "POST" && url.includes("/login")) {
    return { action: "ADMIN_LOGIN", entityType: "SystemAdmin" };
  }

  if (method === "POST" && url.includes("/logout")) {
    return { action: "ADMIN_LOGOUT", entityType: "SystemAdmin" };
  }

  if (method === "POST" && url.includes("/admins")) {
    return { action: "ADMIN_CREATED", entityType: "SystemAdmin" };
  }

  if (method === "PATCH" && url.includes("/suspend")) {
    return { action: "ADMIN_SUSPENDED", entityType: "SystemAdmin" };
  }

  if (method === "PATCH" && url.includes("reset-password")) {
    return { action: "ADMIN_PASSWORD_RESET", entityType: "SystemAdmin" };
  }

  if (method === "PATCH" && url.includes("/admins/")) {
    return { action: "ADMIN_UPDATED", entityType: "SystemAdmin" };
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Automatic Admin Audit Middleware
|--------------------------------------------------------------------------
*/

async function adminAudit(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return next();
    }

    const mapping = detectAction(req);

    if (!mapping) {
      return next();
    }

    const entityId = extractEntityId(req);

    await prisma.auditLog.create({
      data: {
        action: mapping.action,
        entityType: mapping.entityType,
        entityId,
        meta: {
          adminId: user.id,
          role: user.role,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          method: req.method,
          endpoint: req.originalUrl,
        },
      },
    });

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = adminAudit;
