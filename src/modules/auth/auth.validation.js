const Joi = require("joi");

/**
 * =====================================================
 * BUSINESS OWNER SIGNUP
 * =====================================================
 */
const ownerSignupSchema = Joi.object({
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
const verifyEmailSchema = Joi.object({
  code: Joi.string().length(6).required(),
});

/**
 * =====================================================
 * ACCEPT BUSINESS INVITE
 * =====================================================
 */
const acceptInviteSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

/**
 * =====================================================
 * LOGIN (SYSTEM / BUSINESS USERS)
 * =====================================================
 */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * =====================================================
 * REFRESH TOKEN
 * =====================================================
 */
const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required(),
});

const passwordResetSchema = Joi.object({
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
const customerIdentifySchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
});

/**
 * STEP 2: Request OTP (scoped to business)
 */
const customerRequestOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
  businessId: Joi.string().uuid().required(),
});

/**
 * STEP 3: Verify OTP
 */
const customerVerifyOtpSchema = Joi.object({
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
 * SYSTEM (SUPER ADMIN) LOGIN
 * =====================================================
 */
const systemLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = {
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
  systemLoginSchema,
};
