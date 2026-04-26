const prisma = require("../config/prisma");
const response = require("../utils/response");

/*
|--------------------------------------------------------------------------
| Permission Cache (In-Memory)
|--------------------------------------------------------------------------
*/

const permissionCache = new Map();

/*
|--------------------------------------------------------------------------
| Build Permission Key
|--------------------------------------------------------------------------
*/

function buildPermissionKey(module, action, scope) {
  return `${module}_${action}_${scope}`;
}

async function logPermissionViolation(req, user, module, action, scope) {
  try {
    await handleSecurityEvent({
      type: "PRIVILEGE_ESCALATION_ATTEMPT",
      title: "Permission violation",
      description: `User role ${user?.role} attempted unauthorized action`,
      source: "API",
      referenceId: user?.id || null,
      metadata: {
        module,
        action,
        scope,
        path: req.originalUrl,
        method: req.method,
        role: user?.role,
        ip: req.ip,
      },
    });
  } catch (err) {
    // usivunje flow kama logging imefail
    console.error("Incident logging failed:", err.message);
  }
}
/*
|--------------------------------------------------------------------------
| Require Permission Middleware
|--------------------------------------------------------------------------
*/

module.exports = function requirePermission({ module, action, scope }) {
  return async (req, res, next) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | AUTH USER CHECK
      |--------------------------------------------------------------------------
      */

      const user = req.user;

      if (!user) {
        return response.error(req, res, null, 401, "auth.unauthorized");
      }

      /*
      |--------------------------------------------------------------------------
      | SUPER ADMIN BYPASS
      |--------------------------------------------------------------------------
      */

      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      /*
      |--------------------------------------------------------------------------
      | BUILD PERMISSION KEYS
      |--------------------------------------------------------------------------
      */

      const permissionKey = buildPermissionKey(module, action, scope);
      const globalPermissionKey = buildPermissionKey(module, action, "GLOBAL");

      /*
      |--------------------------------------------------------------------------
      | CHECK PERMISSIONS FROM JWT
      |--------------------------------------------------------------------------
      */

      if (user.permissions && Array.isArray(user.permissions)) {
        if (user.permissions.includes(permissionKey)) {
          return next();
        }

        // 🔥 GLOBAL FALLBACK (JWT LEVEL)
        if (user.permissions.includes(globalPermissionKey)) {
          return next();
        }
      }

      /*
      |--------------------------------------------------------------------------
      | CACHE KEY
      |--------------------------------------------------------------------------
      */

      const cacheKey = `${user.role}_${permissionKey}`;

      if (permissionCache.has(cacheKey)) {
        const allowed = permissionCache.get(cacheKey);

        if (allowed) {
          return next();
        }

        await logPermissionViolation(req, user, module, action, scope);
        return response.error(req, res, null, 403, "auth.forbidden");
      }

      /*
      |--------------------------------------------------------------------------
      | FIND PERMISSION (EXACT)
      |--------------------------------------------------------------------------
      */

      let permission = await prisma.permission.findUnique({
        where: {
          module_action_scope: {
            module,
            action,
            scope,
          },
        },
      });

      /*
      |--------------------------------------------------------------------------
      | GLOBAL FALLBACK (DB LEVEL)
      |--------------------------------------------------------------------------
      */

      if (!permission) {
        permission = await prisma.permission.findUnique({
          where: {
            module_action_scope: {
              module,
              action,
              scope: "GLOBAL",
            },
          },
        });
      }

      if (!permission) {
        permissionCache.set(cacheKey, false);

        return response.error(req, res, null, 403, "auth.permission_not_found");
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK ROLE PERMISSION
      |--------------------------------------------------------------------------
      */

      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          role: user.role,
          permissionId: permission.id,
        },
      });

      const allowed = !!rolePermission;

      /*
      |--------------------------------------------------------------------------
      | CACHE RESULT
      |--------------------------------------------------------------------------
      */

      permissionCache.set(cacheKey, allowed);

      if (!allowed) {
        await logPermissionViolation(req, user, module, action, scope);
        return response.error(req, res, null, 403, "auth.forbidden");
      }

      /*
      |--------------------------------------------------------------------------
      | PERMISSION GRANTED
      |--------------------------------------------------------------------------
      */

      return next();
    } catch (error) {
      /*
      |--------------------------------------------------------------------------
      | ERROR HANDLER
      |--------------------------------------------------------------------------
      */

      next(error);
    }
  };
};
