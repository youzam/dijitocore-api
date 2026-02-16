const Joi = require("joi");

/* ===========================
   COMMON
=========================== */

const billingCycleSchema = Joi.string().valid("MONTHLY", "YEARLY").required();

const uuidSchema = Joi.string().uuid().required();

/* ===========================
   SUBSCRIPTION
=========================== */

exports.createSubscription = Joi.object({
  packageId: uuidSchema,
  billingCycle: billingCycleSchema,
});

exports.upgradeSubscription = Joi.object({
  packageId: uuidSchema,
  billingCycle: billingCycleSchema,
});

/* ===========================
   PACKAGE MANAGEMENT
=========================== */

exports.createPackage = Joi.object({
  name: Joi.string().trim().min(2).required(),

  // Strict uppercase code (letters, numbers, underscore only)
  code: Joi.string()
    .pattern(/^[A-Z0-9_]+$/)
    .required(),

  description: Joi.string().allow("", null),

  priceMonthly: Joi.number().integer().min(0).required(),

  priceYearly: Joi.number().integer().min(0).allow(null),

  setupFee: Joi.number().integer().min(0).required(),

  trialDays: Joi.number().integer().min(0).required(),

  // Must not be empty object
  features: Joi.object().min(1).required(),

  isActive: Joi.boolean().optional(),
});

exports.updatePackage = Joi.object({
  name: Joi.string().trim().min(2).optional(),

  description: Joi.string().allow("", null),

  priceMonthly: Joi.number().integer().min(0).optional(),

  priceYearly: Joi.number().integer().min(0).allow(null).optional(),

  setupFee: Joi.number().integer().min(0).optional(),

  trialDays: Joi.number().integer().min(0).optional(),

  features: Joi.object().min(1).optional(),

  isActive: Joi.boolean().optional(),
})
  // Prevent empty PATCH body
  .min(1);
