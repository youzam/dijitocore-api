const express = require("express");

const authController = require("./auth.controller");
const validate = require("../../middlewares/validate.middleware");
const { authRateLimiter } = require("../../middlewares/rateLimit.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");
const customerAuthController = require("./customer.auth.controller");
const customerAuthValidation = require("./customer.auth.validation");

const {
  ownerSignupSchema,
  verifyEmailSchema,
  loginSchema,
  refreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  acceptInviteSchema,
  systemLoginSchema,
} = require("./auth.validation");

const router = express.Router();

/**
 * =====================================================
 * PUBLIC AUTH – BUSINESS OWNER
 * =====================================================
 */
router.post(
  "/signup",
  authRateLimiter,
  validate(ownerSignupSchema),
  authController.ownerSignup,
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login,
);

router.post(
  "/refresh",
  authRateLimiter,
  validate(refreshSchema),
  authController.refresh,
);

router.post("/logout", authMiddleware, authController.logout);

/**
 * =====================================================
 * SYSTEM (SUPER ADMIN) LOGIN
 * =====================================================
 */
router.post(
  "/system/login",
  authRateLimiter,
  validate(systemLoginSchema),
  authController.systemLogin,
);

/**
 * =====================================================
 * ACCEPT BUSINESS INVITE (PUBLIC)
 * =====================================================
 */
router.post(
  "/accept-invite",
  authRateLimiter,
  validate(acceptInviteSchema),
  authController.acceptInvite,
);

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
router.post(
  "/password/request-reset",
  authRateLimiter,
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset,
);

router.post(
  "/password/reset",
  authRateLimiter,
  validate(passwordResetSchema),
  authController.resetPassword,
);

/**
 * =====================================================
 * CUSTOMER AUTH (PUBLIC)
 * =====================================================
 */

router.post(
  "/customer/request-otp",
  authRateLimiter,
  validate(customerAuthValidation.requestOtp),
  customerAuthController.requestOtp,
);

router.post(
  "/customer/verify-otp",
  authRateLimiter,
  validate(customerAuthValidation.verifyOtp),
  customerAuthController.verifyOtp,
);

router.post(
  "/customer/set-pin",
  validate(customerAuthValidation.setPin),
  customerAuthController.setPin,
);

router.post(
  "/customer/login",
  authRateLimiter,
  validate(customerAuthValidation.loginWithPin),
  customerAuthController.loginWithPin,
);

router.post(
  "/customer/forgot-pin",
  authRateLimiter,
  validate(customerAuthValidation.requestOtp),
  customerAuthController.requestOtp,
);

router.post(
  "/system/users/:userId/force-logout",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  authController.forceLogoutUser,
);

module.exports = router;
