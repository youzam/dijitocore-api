const AppError = require("../utils/AppError");

/**
 * =====================================================
 * TENANT ISOLATION MIDDLEWARE
 * =====================================================
 */
const tenantMiddleware = (req, res, next) => {
  if (!req.auth) {
    return next(new AppError("auth.unauthorized", 401));
  }

  /**
   * System (Super Admin) bypass
   */
  if (req.auth.identityType === "system") {
    return next();
  }

  /**
   * Owner before business creation
   */
  if (
    req.auth.identityType === "business" &&
    req.auth.role === "BUSINESS_OWNER" &&
    !req.auth.businessId
  ) {
    return next();
  }

  /**
   * Enforce business scope
   */
  if (!req.auth.businessId) {
    return next(new AppError("auth.unauthorized", 401));
  }

  /**
   * If route includes businessId param, enforce match
   */
  if (req.params.businessId && req.params.businessId !== req.auth.businessId) {
    return next(new AppError("auth.unauthorized", 403));
  }

  next();
};

module.exports = tenantMiddleware;
