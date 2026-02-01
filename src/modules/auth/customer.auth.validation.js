const Joi = require("joi");

exports.requestOtp = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
});

exports.verifyOtp = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
  otp: Joi.string().length(6).required(),
});

exports.setPin = Joi.object({
  customerId: Joi.string().uuid().required(),
  pin: Joi.string().min(4).max(6).required(),
});

exports.loginWithPin = Joi.object({
  phone: Joi.string().required(),
  businessCode: Joi.string().required(),
  pin: Joi.string().required(),
});
