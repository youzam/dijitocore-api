const Joi = require('joi');

/**
 * DATA REQUEST
 */
exports.createDataRequest = Joi.object({
  type: Joi.string().valid('EXPORT', 'DELETE').required(),
  targetType: Joi.string().valid('USER', 'CUSTOMER').required(),
  targetId: Joi.string().required(),
});
