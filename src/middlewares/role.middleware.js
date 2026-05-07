const AppError = require('../utils/AppError.js');
const { handleSecurityIncident } = require('../utils/incidentEngine');

/**
 * =====================================================
 * ROLE-BASED ACCESS CONTROL
 * - Business users enforced
 * - System users bypass
 * =====================================================
 */
const roleMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    if (!req.auth) {
      return next(new AppError('auth.unauthorized', 401));
    }

    /**
     * SYSTEM (SUPER ADMIN) — FULL BYPASS
     */
    if (req.auth.identityType === 'system') {
      return next();
    }

    /**
     * 🔴 CUSTOMER WRITE ATTEMPT PROTECTION (ADDED)
     */
    if (req.auth.identityType === 'customer' && req.method !== 'GET') {
      await handleSecurityIncident({
        type: 'CUSTOMER_WRITE_ATTEMPT',
        title: 'Customer attempted write operation',
        description: `Customer ${req.auth.id} attempted ${req.method} on ${req.originalUrl}`,
        source: 'API',
        referenceId: req.auth.id || null,
        metadata: {
          path: req.originalUrl,
          method: req.method,
          role: req.auth.role,
          identityType: req.auth.identityType,
          ip: req.ip,
          body: req.body,
        },
      });

      return next(new AppError('auth.customer_read_only', 403));
    }

    /**
     * BUSINESS & CUSTOMER USERS
     */
    if (!['business', 'customer'].includes(req.auth.identityType)) {
      return next(new AppError('auth.unauthorized', 401));
    }

    if (!req.auth.role) {
      return next(new AppError('auth.unauthorized', 401));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      await handleSecurityIncident({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        title: 'Privilege escalation attempt',
        description: `Role ${req.auth.role} attempted restricted access`,
        source: 'API',
        referenceId: req.auth.id || null,
        metadata: {
          path: req.originalUrl,
          method: req.method,
          role: req.auth.role,
          allowedRoles,
          identityType: req.auth.identityType,
          ip: req.ip,
        },
      });

      return next(new AppError('auth.unauthorized', 403));
    }

    next();
  };
};

module.exports = roleMiddleware;
