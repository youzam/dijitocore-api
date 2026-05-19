const Joi = require('joi');

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
exports.updateGateway = Joi.object({
  gateways: Joi.array().items(Joi.string()).min(1).required(),
});

/*
|--------------------------------------------------------------------------
| Update Security Config
|--------------------------------------------------------------------------
*/
exports.updateSecurityConfig = Joi.object({
  maxLoginAttempts: Joi.number().integer().min(1).required(),
  lockTimeMinutes: Joi.number().integer().min(1).required(),
});
