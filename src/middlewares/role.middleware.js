const AppError = require("../utils/AppError.js");

/**
 * =====================================================
 * ROLE-BASED ACCESS CONTROL
 * - Business users enforced
 * - System users bypass
 * =====================================================
 */
const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.auth) {
      return next(new AppError("auth.unauthorized", 401));
    }

    /**
     * SYSTEM (SUPER ADMIN) — FULL BYPASS
     */
    if (req.auth.identityType === "system") {
      return next();
    }

    /**
     * BUSINESS USERS
     */
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
