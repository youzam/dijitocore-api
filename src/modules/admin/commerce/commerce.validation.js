const Joi = require('joi');

/* ===========================
   COMMON
=========================== */

const uuidSchema = Joi.string().uuid().required();

/* ===========================
   LEDGER
=========================== */

exports.getLedger = Joi.object({
  page: Joi.number().integer().min(1).optional(),

  limit: Joi.number().integer().min(1).max(100).optional(),

  status: Joi.string().optional(),

  referenceType: Joi.string().optional(),

  gateway: Joi.string().optional(),

  packageId: Joi.string().optional(),

  subscriptionId: Joi.string().optional(),

  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),

  businessId: Joi.string().optional(),

  search: Joi.string().optional(),

  orderBy: Joi.string()
    .valid('createdAt', 'amount', 'status', 'gateway')
    .optional(),

  order: Joi.string().valid('asc', 'desc').optional(),
});

exports.getLedgerEntry = Joi.object({
  id: uuidSchema,
});

exports.getLedgerDrilldown = Joi.object({
  id: uuidSchema,
});

exports.getLedgerAnalytics = Joi.object({
  businessId: Joi.string().optional(),

  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

/* ===========================
   FINANCIAL
=========================== */

exports.createAdjustment = Joi.object({
  businessId: uuidSchema,
  amount: Joi.number().required(),
  type: Joi.string().valid('CREDIT', 'DEBIT').required(),
  reason: Joi.string().allow('', null),
});

/* ===========================
   COUPONS
=========================== */

exports.createCoupon = Joi.object({
  code: Joi.string().trim().required(),

  type: Joi.string().valid('PERCENTAGE', 'FIXED').required(),

  value: Joi.number().positive().required(),

  maxUsage: Joi.number().integer().min(1).optional(),

  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),

  isActive: Joi.boolean().optional(),
});

exports.updateCoupon = Joi.object({
  code: Joi.string().trim().optional(),

  type: Joi.string().valid('PERCENTAGE', 'FIXED').optional(),

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
  description: Joi.string().trim().optional(),

  code: Joi.string()
    .pattern(/^[A-Z0-9_]+$/)
    .required(),

  priceMonthly: Joi.number().min(0).required(),

  priceYearly: Joi.number().min(0).allow(null).optional(),

  setupFee: Joi.number().min(0).optional(),

  features: Joi.object().optional(),

  limits: Joi.object().optional(),

  isActive: Joi.boolean().optional(),
});

exports.updatePackage = Joi.object({
  name: Joi.string().trim().min(2).optional(),

  code: Joi.string()
    .pattern(/^[A-Z0-9_]+$/)
    .optional(),

  priceMonthly: Joi.number().min(0).optional(),

  priceYearly: Joi.number().min(0).allow(null).optional(),

  setupFee: Joi.number().min(0).optional(),

  features: Joi.object().optional(),

  limits: Joi.object().optional(),

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
