const Joi = require("joi");

/* ===========================
   COMMON
=========================== */

const uuidSchema = Joi.string().uuid().required();

/* ===========================
   TRANSACTIONS
=========================== */

exports.getTransactions = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),

  status: Joi.string().optional(),
  type: Joi.string().optional(),
  gateway: Joi.string().optional(),

  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),

  businessId: Joi.string().optional(),
});

/* ===========================
   FINANCIAL
=========================== */

exports.createAdjustment = Joi.object({
  businessId: uuidSchema,
  amount: Joi.number().required(),
  type: Joi.string().valid("CREDIT", "DEBIT").required(),
  reason: Joi.string().allow("", null),
});

/* ===========================
   COUPONS
=========================== */

exports.createCoupon = Joi.object({
  code: Joi.string().trim().required(),

  type: Joi.string().valid("PERCENTAGE", "FIXED").required(),

  value: Joi.number().positive().required(),

  maxUsage: Joi.number().integer().min(1).optional(),

  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),

  isActive: Joi.boolean().optional(),
});

exports.updateCoupon = Joi.object({
  code: Joi.string().trim().optional(),

  type: Joi.string().valid("PERCENTAGE", "FIXED").optional(),

  value: Joi.number().positive().optional(),

  maxUsage: Joi.number().integer().min(1).optional(),

  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),

  isActive: Joi.boolean().optional(),
});

exports.applyCoupon = Joi.object({
  code: Joi.string().required(),
  businessId: uuidSchema,
});

/* ===========================
   PACKAGES
=========================== */

exports.createPackage = Joi.object({
  name: Joi.string().trim().min(2).required(),

  code: Joi.string()
    .pattern(/^[A-Z0-9_]+$/)
    .required(),

  price: Joi.number().min(0).required(),

  currency: Joi.string().optional(),

  features: Joi.object().optional(),
  limits: Joi.object().optional(),

  isActive: Joi.boolean().optional(),
});

exports.updatePackage = Joi.object({
  name: Joi.string().trim().min(2).optional(),

  code: Joi.string()
    .pattern(/^[A-Z0-9_]+$/)
    .optional(),

  price: Joi.number().min(0).optional(),

  currency: Joi.string().optional(),

  isActive: Joi.boolean().optional(),
});

exports.updatePackageConfiguration = Joi.object({
  features: Joi.object().optional(),
  limits: Joi.object().optional(),
});

/* ===========================
   SUBSCRIPTION CONTROL
=========================== */

exports.changePlan = Joi.object({
  packageId: uuidSchema,
});

exports.extendSubscription = Joi.object({
  days: Joi.number().integer().min(1).required(),
});

exports.extendGrace = Joi.object({
  days: Joi.number().integer().min(1).required(),
});
