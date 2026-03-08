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
      | BUILD PERMISSION KEY
      |--------------------------------------------------------------------------
      */

      const permissionKey = buildPermissionKey(module, action, scope);

      /*
      |--------------------------------------------------------------------------
      | CHECK PERMISSIONS FROM JWT
      |--------------------------------------------------------------------------
      */

      if (user.permissions && Array.isArray(user.permissions)) {
        if (user.permissions.includes(permissionKey)) {
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

        return response.error(req, res, null, 403, "auth.forbidden");
      }

      /*
      |--------------------------------------------------------------------------
      | FIND PERMISSION
      |--------------------------------------------------------------------------
      */

      const permission = await prisma.permission.findUnique({
        where: {
          module_action_scope: {
            module,
            action,
            scope,
          },
        },
      });

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
