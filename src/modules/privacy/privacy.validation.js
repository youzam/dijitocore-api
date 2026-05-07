const Joi = require('joi');

/**
 * DATA REQUEST
 */
exports.createDataRequest = Joi.object({
  type: Joi.string().valid('EXPORT', 'DELETE').required(),
  targetType: Joi.string().valid('USER', 'CUSTOMER').required(),
  targetId: Joi.string().required(),
});

/**
 * CONSENTS (ULIKUWA NAYO TAYARI)
 */
exports.createConsent = Joi.object({
  type: Joi.string().required(),
  source: Joi.string().optional(),
});

exports.updateConsent = Joi.object({
  type: Joi.string().required(),
  status: Joi.string().valid('GRANTED', 'REVOKED').required(),
});
