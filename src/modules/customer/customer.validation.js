const Joi = require("joi");

exports.createCustomer = Joi.object({
  fullName: Joi.string().min(2).required(),

  phone: Joi.string().required(),
  altPhone: Joi.string().optional(),

  email: Joi.string().email().optional(),

  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").optional(),
  dateOfBirth: Joi.date().optional(),

  addressLine: Joi.string().optional(),
  ward: Joi.string().optional(),
  district: Joi.string().optional(),
  region: Joi.string().optional(),

  nationalId: Joi.string().optional(),
  idType: Joi.string().optional(),

  occupation: Joi.string().optional(),
  employerName: Joi.string().optional(),
  monthlyIncome: Joi.number().optional(),

  guarantorName: Joi.string().optional(),
  guarantorPhone: Joi.string().optional(),
  relationship: Joi.string().optional(),

  notes: Joi.string().optional(),
});

exports.updateCustomer = Joi.object({
  fullName: Joi.string().optional(),

  phone: Joi.string().optional(),
  altPhone: Joi.string().optional(),

  email: Joi.string().email().optional(),

  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").optional(),
  dateOfBirth: Joi.date().optional(),

  addressLine: Joi.string().optional(),
  ward: Joi.string().optional(),
  district: Joi.string().optional(),
  region: Joi.string().optional(),

  nationalId: Joi.string().optional(),
  idType: Joi.string().optional(),

  occupation: Joi.string().optional(),
  employerName: Joi.string().optional(),
  monthlyIncome: Joi.number().optional(),

  guarantorName: Joi.string().optional(),
  guarantorPhone: Joi.string().optional(),
  relationship: Joi.string().optional(),

  status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),

  notes: Joi.string().optional(),
});

exports.updateStatus = Joi.object({
  status: Joi.string().valid("ACTIVE", "INACTIVE").required(),
});

exports.updateBlacklist = Joi.object({
  isBlacklisted: Joi.boolean().required(),
});
