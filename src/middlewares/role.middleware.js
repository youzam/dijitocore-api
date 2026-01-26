const AppError = require("../utils/AppError.js");

/**
 * =====================================================
 * ROLE-BASED ACCESS CONTROL (RBAC)
 * - Business users only
 * =====================================================
 */
const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.auth) {
      return next(new AppError("auth.unauthorized", 401));
    }

    // Only business identity has roles
    if (req.auth.identityType !== "business") {
      return next(new AppError("auth.unauthorized", 401));
    }

    if (!req.auth.role) {
      return next(new AppError("auth.unauthorized", 401));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(new AppError("auth.unauthorized", 403));
    }

    next();
  };
};

module.exports = roleMiddleware;
