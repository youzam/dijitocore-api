const Joi = require("joi");

exports.createBusiness = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().optional().allow(null, ""),
  phone: Joi.string().optional().allow(null, ""),
  currency: Joi.string().min(2).required(),
  timezone: Joi.string().required(),
});

exports.updateSettings = Joi.object({
  currency: Joi.string().min(2).optional(),
  timezone: Joi.string().optional(),
});

/**
 * Invite business user (OWNER)
 */
exports.inviteUser = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid("MANAGER", "STAFF").required(),
});

/**
 * Update existing user
 */
exports.updateUser = Joi.object({
  role: Joi.string().valid("MANAGER", "STAFF").optional(),
  status: Joi.string().valid("ACTIVE", "SUSPENDED").optional(),
});
