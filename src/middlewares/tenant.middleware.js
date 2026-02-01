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
   * =====================================================
   * SYSTEM (SUPER ADMIN)
   * Inject business context dynamically
   * =====================================================
   */
  if (req.auth.identityType === "system") {
    if (req.params.businessId) {
      req.user = {
        businessId: req.params.businessId,
        role: "SUPER_ADMIN",
      };
    }

    return next();
  }

  /**
   * =====================================================
   * OWNER before business creation
   * =====================================================
   */
  if (
    req.auth.identityType === "business" &&
    req.auth.role === "BUSINESS_OWNER" &&
    !req.auth.businessId
  ) {
    return next();
  }

  /**
   * =====================================================
   * Enforce business scope
   * =====================================================
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

  /**
   * Attach business context for controllers
   */
  req.user = req.user || {};
  req.user.businessId = req.auth.businessId;

  next();
};

module.exports = tenantMiddleware;
