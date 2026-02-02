const Joi = require("joi");

exports.recordPayment = Joi.object({
  contractId: Joi.string().uuid().required(),
  customerId: Joi.string().uuid().required(),
  amount: Joi.number().integer().positive().required(),

  channel: Joi.string().valid("CASH", "MOBILE", "BANK").required(),
  source: Joi.string().valid("POS", "WEB", "IMPORT", "API").required(),

  reference: Joi.string().allow(null, ""),
  attachments: Joi.array().items(Joi.object()).optional(),
  receivedAt: Joi.date().optional(),
});

exports.requestReversal = Joi.object({
  reason: Joi.string().min(3).required(),
});

exports.listPayments = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),

  contractId: Joi.string().uuid().optional(),
  customerId: Joi.string().uuid().optional(),
  reference: Joi.string().optional(),
  status: Joi.string().valid("POSTED", "REVERSED").optional(),

  sortBy: Joi.string().valid("createdAt", "amount", "receivedAt").optional(),
  sortOrder: Joi.string().valid("asc", "desc").optional(),
});

exports.listReversals = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid("PENDING", "APPROVED", "REJECTED").optional(),
});
