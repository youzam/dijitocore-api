const express = require("express");

const authController = require("./auth.controller");
const validate = require("../../middlewares/validate.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");

const {
  ownerSignupSchema,
  verifyEmailSchema,
  loginSchema,
  refreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  customerIdentifySchema,
  customerRequestOtpSchema,
  customerVerifyOtpSchema,
  acceptInviteSchema,
} = require("./auth.validation");

const router = express.Router();

/**
 * =====================================================
 * PUBLIC AUTH – BUSINESS OWNER
 * =====================================================
 */
router.post(
  "/signup",
  rateLimit,
  validate(ownerSignupSchema),
  authController.ownerSignup,
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

router.post("/login", rateLimit, validate(loginSchema), authController.login);

router.post(
  "/refresh",
  rateLimit,
  validate(refreshSchema),
  authController.refresh,
);

router.post("/logout", authMiddleware, authController.logout);

/**
 * =====================================================
 * ACCEPT BUSINESS INVITE (PUBLIC)
 * =====================================================
 */
router.post(
  "/accept-invite",
  rateLimit,
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
  rateLimit,
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset,
);

router.post(
  "/password/reset",
  rateLimit,
  validate(passwordResetSchema),
  authController.resetPassword,
);

/**
 * =====================================================
 * CUSTOMER AUTH
 * =====================================================
 */
router.post(
  "/customer/identify",
  rateLimit,
  validate(customerIdentifySchema),
  authController.customerIdentify,
);

router.post(
  "/customer/request-otp",
  rateLimit,
  validate(customerRequestOtpSchema),
  authController.customerRequestOtp,
);

router.post(
  "/customer/verify-otp",
  rateLimit,
  validate(customerVerifyOtpSchema),
  authController.customerVerifyOtp,
);

module.exports = router;
