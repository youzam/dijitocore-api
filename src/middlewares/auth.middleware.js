const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma.js");
const jwtConfig = require("../config/jwt.js");
const AppError = require("../utils/AppError.js");

const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("auth.unauthorized", 401));
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.accessSecret);
  } catch (err) {
    return next(new AppError("auth.token_invalid", 401));
  }

  /**
   * =====================================================
   * STRICT TOKEN REQUIREMENTS
   * =====================================================
   */
  if (!payload.identity_type) {
    return next(new AppError("auth.token_invalid", 401));
  }

  /**
   * Standard auth context
   */
  req.auth = {
    id: payload.sub,
    identityType: payload.identity_type,
    role: payload.role || null,
    businessId: payload.businessId || null,
    scope: payload.scope || [],
  };

  /**
   * =====================================================
   * BUSINESS USER
   * =====================================================
   */
  if (payload.identity_type === "business") {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        businessId: true,
        role: true,
        business: {
          select: {
            setupCompleted: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new AppError("auth.unauthorized", 401));
    }

    // Owner before business creation is allowed
    if (payload.businessId && user.businessId !== payload.businessId) {
      return next(new AppError("auth.unauthorized", 401));
    }

    req.user = user;

    /**
     * -----------------------------------------------------
     * BLOCK SYSTEM ACCESS UNTIL BUSINESS ONBOARDING COMPLETE
     * -----------------------------------------------------
     */
    if (
      user.businessId &&
      user.business &&
      user.business.setupCompleted === false
    ) {
      const allowedPaths = ["/businesses", "/auth/logout"];

      const isAllowed = allowedPaths.some((path) =>
        req.originalUrl.startsWith(path),
      );

      if (!isAllowed) {
        return next(new AppError("business.onboardingRequired", 403));
      }
    }

    return next();
  }

  /**
   * =====================================================
   * CUSTOMER
   * =====================================================
   */
  if (payload.identity_type === "customer") {
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        businessId: true,
      },
    });

    if (!customer || customer.status !== "ACTIVE") {
      return next(new AppError("auth.unauthorized", 401));
    }

    if (customer.businessId !== payload.businessId) {
      return next(new AppError("auth.unauthorized", 401));
    }

    req.auth.customer = customer;
    req.user = customer;
    return next();
  }

  /**
   * =====================================================
   * SYSTEM (SUPER ADMIN)
   * =====================================================
   */
  if (payload.identity_type === "system") {
    req.auth.system = true;

    if (req.params.businessId) {
      req.user = {
        businessId: req.params.businessId,
        role: "SUPER_ADMIN",
      };
    }

    return next();
  }

  return next(new AppError("auth.unauthorized", 401));
};

module.exports = authMiddleware;
