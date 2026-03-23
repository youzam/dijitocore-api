const express = require("express");

const controller = require("./auth.controller");
const validate = require("../../middlewares/validate.middleware");
const { authRateLimiter } = require("../../middlewares/rateLimit.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");

const validation = require("./auth.validation");

const router = express.Router();

/**
 * =====================================================
 * PUBLIC AUTH – BUSINESS OWNER
 * =====================================================
 */
router.post(
  "/signup",
  authRateLimiter,
  validate(validation.ownerSignup),
  controller.ownerSignup,
);

router.post(
  "/verify-email",
  validate(validation.verifyEmail),
  controller.verifyEmail,
);

router.post(
  "/login",
  authRateLimiter,
  validate(validation.login),
  controller.login,
);

router.post(
  "/refresh",
  authRateLimiter,
  validate(validation.refresh),
  controller.refresh,
);

router.post("/logout", authMiddleware, controller.logout);

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
router.post(
  "/password/request-reset",
  authRateLimiter,
  validate(validation.passwordResetRequest),
  controller.requestPasswordReset,
);

router.post(
  "/password/reset",
  authRateLimiter,
  validate(validation.passwordReset),
  controller.resetPassword,
);

/**
 * =====================================================
 * CUSTOMER AUTH (PUBLIC)
 * =====================================================
 */

router.post(
  "/customer/identify",
  authRateLimiter,
  validate(validation.customerIdentify),
  controller.customerIdentify,
);

router.post(
  "/customer/request-otp",
  authRateLimiter,
  validate(validation.customerRequestOtp),
  controller.customerRequestOtp,
);

router.post(
  "/customer/verify-otp",
  authRateLimiter,
  validate(validation.customerVerifyOtp),
  controller.customerVerifyOtp,
);

router.post(
  "/customer/set-pin",
  validate(validation.setPin),
  controller.setPin,
);

router.post(
  "/customer/login",
  authRateLimiter,
  validate(validation.loginWithPin),
  controller.loginWithPin,
);

router.post(
  "/customer/forgot-pin",
  authRateLimiter,
  validate(validation.customerRequestOtp),
  controller.customerRequestOtp,
);

module.exports = router;
