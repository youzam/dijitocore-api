const Joi = require('joi');

exports.ownerSignup = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),

  email: Joi.string().email().required(),

  password: Joi.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .required(),

  packageId: Joi.string().required(),

  billingCycle: Joi.string().valid('MONTHLY', 'YEARLY').required(),

  acceptedTerms: Joi.boolean().valid(true).required(),

  acceptedPrivacy: Joi.boolean().valid(true).required(),
});

exports.verifyEmail = Joi.object({
  code: Joi.string().length(6).required(),
});

exports.login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

exports.refresh = Joi.object({
  refresh_token: Joi.string().required(),
});

exports.logout = Joi.object({
  refresh_token: Joi.string().optional(),
});

exports.passwordResetRequest = Joi.object({
  email: Joi.string().email().required(),
});

exports.passwordReset = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'number')
    .required(),
});

exports.customerRequestOtp = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
});

exports.customerVerifyOtp = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
  otp: Joi.string().length(6).required(),
});

exports.setPin = Joi.object({
  pin: Joi.string().min(4).max(6).required(),
  acceptedTerms: Joi.boolean().valid(true).required(),
  acceptedPrivacy: Joi.boolean().valid(true).required(),
});

exports.loginWithPin = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required(),
  businessCode: Joi.string().trim().required(),
  pin: Joi.string().required(),
});

exports.adminLogin = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
