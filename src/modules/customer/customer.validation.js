const Joi = require("joi");

exports.createCustomer = Joi.object({
  fullName: Joi.string().min(2).required(),
  phone: Joi.string().required(),
  altPhone: Joi.string().optional(),
  email: Joi.string().email().optional(),

  gender: Joi.string().optional(),
  dateOfBirth: Joi.date().optional(),

  addressLine: Joi.string().optional(),
  ward: Joi.string().optional(),
  district: Joi.string().optional(),
  region: Joi.string().optional(),

  nationalId: Joi.string().optional(),
  idType: Joi.string().optional(),

  occupation: Joi.string().optional(),
  employerName: Joi.string().optional(),
  monthlyIncome: Joi.number().integer().optional(),

  guarantorName: Joi.string().optional(),
  guarantorPhone: Joi.string().optional(),
  relationship: Joi.string().optional(),

  notes: Joi.string().optional(),
});
