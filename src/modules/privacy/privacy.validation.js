const Joi = require("joi");

exports.createConsent = Joi.object({
  type: Joi.string().required(),
  source: Joi.string().optional(),
});

exports.updateConsent = Joi.object({
  type: Joi.string().required(),
  status: Joi.string().valid("GRANTED", "REVOKED").required(),
});
