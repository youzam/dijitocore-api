const AppError = require("../utils/AppError");
const prisma = require("../config/prisma");

/**
 * =====================================================
 * TENANT ISOLATION MIDDLEWARE
 * =====================================================
 */
const tenantMiddleware = async (req, res, next) => {
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
   * =====================================================
   * HARDENING PATCH: BUSINESS + SUBSCRIPTION ENFORCEMENT
   * =====================================================
   */

  try {
    const business = await prisma.business.findUnique({
      where: { id: req.auth.businessId },
      select: {
        status: true,
      },
    });

    if (!business) {
      return next(new AppError("auth.unauthorized", 403));
    }

    // Allow ACTIVE and GRACE businesses
    if (!["ACTIVE", "GRACE"].includes(business.status)) {
      return next(new AppError("business.inactive", 403));
    }

    /**
     * Ensure active subscription exists
     */
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        businessId: req.auth.businessId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!activeSubscription) {
      return next(new AppError("subscription.required", 403));
    }
  } catch (error) {
    return next(error);
  }

  /**
   * Attach business context for controllers
   */
  req.user = req.user || {};
  req.user.businessId = req.auth.businessId;

  next();
};

module.exports = tenantMiddleware;
