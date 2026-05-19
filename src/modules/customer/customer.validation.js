const Joi = require('joi');

exports.createCustomer = Joi.object({
  fullName: Joi.string().min(2).required(),
  phone: Joi.string().required(),
  whatsappPhone: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
  dateOfBirth: Joi.date().optional(),
  addressLine: Joi.string().allow('', null).optional(),
  ward: Joi.string().allow('', null).optional(),
  district: Joi.string().allow('', null).optional(),
  region: Joi.string().allow('', null).optional(),
  nationalId: Joi.string().allow('', null).optional(),
  idType: Joi.string().allow('', null).optional(),
  occupation: Joi.string().allow('', null).optional(),
  employerName: Joi.string().allow('', null).optional(),
  monthlyIncome: Joi.number().optional(),
  guarantorName: Joi.string().allow('', null).optional(),
  guarantorPhone: Joi.string().allow('', null).optional(),
  relationship: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
});

exports.updateCustomer = Joi.object({
  fullName: Joi.string().min(2).required(),
  phone: Joi.string().required(),
  whatsappPhone: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
  dateOfBirth: Joi.date().optional(),
  addressLine: Joi.string().allow('', null).optional(),
  ward: Joi.string().allow('', null).optional(),
  district: Joi.string().allow('', null).optional(),
  region: Joi.string().allow('', null).optional(),
  nationalId: Joi.string().allow('', null).optional(),
  idType: Joi.string().allow('', null).optional(),
  occupation: Joi.string().allow('', null).optional(),
  employerName: Joi.string().allow('', null).optional(),
  monthlyIncome: Joi.number().optional(),
  guarantorName: Joi.string().allow('', null).optional(),
  guarantorPhone: Joi.string().allow('', null).optional(),
  relationship: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
});

exports.updateStatus = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE').required(),
});

exports.updateBlacklist = Joi.object({
  isBlacklisted: Joi.boolean().required(),
});
