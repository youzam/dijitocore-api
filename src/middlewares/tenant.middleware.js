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
      req.user = req.user || {};
      req.user.businessId = req.params.businessId;
      req.user.role = req.user.role || "SUPER_ADMIN";
    }

    return next();
  }

  /**
   * =====================================================
   * OWNER BEFORE BUSINESS CREATION
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
   * ENFORCE BUSINESS SCOPE
   * =====================================================
   */
  if (!req.auth.businessId) {
    return next(new AppError("auth.unauthorized", 401));
  }

  if (req.params.businessId && req.params.businessId !== req.auth.businessId) {
    return next(new AppError("auth.unauthorized", 403));
  }

  /**
   * =====================================================
   * FAST PATH (JWT CLAIM OPTIMIZATION)
   * =====================================================
   * If token already contains business status + subscription
   * we skip database query completely.
   */
  if (
    req.auth.businessStatus &&
    ["ACTIVE", "GRACE"].includes(req.auth.businessStatus) &&
    req.auth.subscriptionActive === true
  ) {
    req.user = req.user || {};
    req.user.businessId = req.auth.businessId;
    return next();
  }

  /**
   * =====================================================
   * HARDENING PATCH: BUSINESS + SUBSCRIPTION ENFORCEMENT
   * OPTIMIZED SINGLE QUERY
   * =====================================================
   */
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.auth.businessId },
      select: {
        status: true,
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!business) {
      return next(new AppError("auth.unauthorized", 403));
    }

    if (!["ACTIVE", "GRACE"].includes(business.status)) {
      return next(new AppError("business.inactive", 403));
    }

    if (!business.subscriptions.length) {
      return next(new AppError("subscription.required", 403));
    }
  } catch (error)  {
    return next(error);
  }

  /**
   * =====================================================
   * ATTACH BUSINESS CONTEXT
   * =====================================================
   */
  req.user = req.user || {};
  req.user.businessId = req.auth.businessId;

  next();
};

module.exports = tenantMiddleware;
