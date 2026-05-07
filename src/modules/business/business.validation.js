const Joi = require('joi');

exports.createBusiness = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  currency: Joi.string().min(2).required(),
  timezone: Joi.string().required(),
});

exports.updateSettings = Joi.object({
  currency: Joi.string().min(2).optional(),
  timezone: Joi.string().optional(),
});

exports.getBusinessDetails = Joi.object({
  businessId: Joi.string().required(),
});
