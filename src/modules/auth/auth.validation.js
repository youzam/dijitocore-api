const Joi = require("joi");

/**
 * =====================================================
 * BUSINESS OWNER SIGNUP
 * =====================================================
 */
exports.ownerSignup = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, "uppercase")
    .pattern(/[a-z]/, "lowercase")
    .pattern(/[0-9]/, "number")
    .required(),
});

/**
 * =====================================================
 * VERIFY EMAIL
 * =====================================================
 */
exports.verifyEmail = Joi.object({
  code: Joi.string().length(6).required(),
});

/**
 * =====================================================
 * LOGIN (SYSTEM / BUSINESS USERS)
 * =====================================================
 */
exports.login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * =====================================================
 * REFRESH TOKEN
 * =====================================================
 */
exports.refresh = Joi.object({
  refresh_token: Joi.string().required(),
});

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
exports.passwordResetRequest = Joi.object({
  email: Joi.string().email().required(),
});

exports.passwordReset = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, "uppercase")
    .pattern(/[a-z]/, "lowercase")
    .pattern(/[0-9]/, "number")
    .required(),
});

/**
 * =====================================================
 * CUSTOMER AUTH – PHONE + OTP
 * =====================================================
 */

/**
 * STEP 1: Identify customer
 */
exports.customerIdentify = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
});

/**
 * STEP 2: Request OTP
 */
exports.customerRequestOtp = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
  businessId: Joi.string().uuid().required(),
});

/**
 * STEP 3: Verify OTP
 */
exports.customerVerifyOtp = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
  businessId: Joi.string().uuid().required(),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required(),
});

/**
 * =====================================================
 * CUSTOMER PIN AUTH
 * =====================================================
 */
exports.setPin = Joi.object({
  customerId: Joi.string().uuid().required(),
  pin: Joi.string().min(4).max(6).required(),
});

exports.loginWithPin = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
  pin: Joi.string().required(),
});

/**
 * =====================================================
 * SYSTEM (SUPER ADMIN) LOGIN
 * =====================================================
 */
exports.adminLogin = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
