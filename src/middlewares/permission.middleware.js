const response = require('../utils/response');
const { handleSecurityIncident } = require('../utils/incidentEngine');

/*
|--------------------------------------------------------------------------
| Permission Cache (In-Memory)
|--------------------------------------------------------------------------
*/

const permissionCache = new Map();

/*
|--------------------------------------------------------------------------
| Log Violation
|--------------------------------------------------------------------------
*/

async function logPermissionViolation(req, user, permission) {
  try {
    await handleSecurityIncident({
      type: 'PRIVILEGE_ESCALATION_ATTEMPT',
      title: 'Permission violation',
      description: `User role ${user?.role} attempted ${permission}`,
      source: 'API',
      referenceId: user?.id || null,
      metadata: {
        permission,
        path: req.originalUrl,
        method: req.method,
        role: user?.role,
        ip: req.ip,
      },
    });
  } catch (err) {
    console.error('Incident logging failed:', err.message);
  }
}

/*
|--------------------------------------------------------------------------
| Require Permission Middleware (NEW)
|--------------------------------------------------------------------------
*/

module.exports = function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | AUTH CHECK
      |--------------------------------------------------------------------------
      */

      const user = req.user;

      if (!user) {
        return response.error(req, res, null, 401, 'auth.unauthorized');
      }

      /*
      |--------------------------------------------------------------------------
      | SUPER ADMIN BYPASS
      |--------------------------------------------------------------------------
      */

      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      /*
      |--------------------------------------------------------------------------
      | USER PERMISSIONS CHECK
      |--------------------------------------------------------------------------
      */

      if (!user.permissions || !Array.isArray(user.permissions)) {
        return response.error(req, res, null, 403, 'auth.forbidden');
      }

      if (user.permissions.includes(requiredPermission)) {
        return next();
      }

      /*
      |--------------------------------------------------------------------------
      | CACHE CHECK
      |--------------------------------------------------------------------------
      */

      const cacheKey = `${user.role}_${requiredPermission}`;

      if (permissionCache.has(cacheKey)) {
        const allowed = permissionCache.get(cacheKey);

        if (allowed) return next();

        await logPermissionViolation(req, user, requiredPermission);
        return response.error(req, res, null, 403, 'auth.forbidden');
      }

      /*
      |--------------------------------------------------------------------------
      | CACHE MISS → DENY
      |--------------------------------------------------------------------------
      */

      permissionCache.set(cacheKey, false);

      await logPermissionViolation(req, user, requiredPermission);

      return response.error(req, res, null, 403, 'auth.forbidden');
    } catch (error) {
      next(error);
    }
  };
};
