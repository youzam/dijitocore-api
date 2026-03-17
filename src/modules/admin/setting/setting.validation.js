const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| Update Currency
|--------------------------------------------------------------------------
*/
exports.updateCurrency = Joi.object({
  currency: Joi.string().required(),
});

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
exports.updateGateway = Joi.object({
  gateway: Joi.string().required(),
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

/*
|--------------------------------------------------------------------------
| Update API Config
|--------------------------------------------------------------------------
*/
exports.updateApiConfig = Joi.object({
  baseUrl: Joi.string().uri().required(),
  timeout: Joi.number().integer().min(1).required(),
});

/*
|--------------------------------------------------------------------------
| Update Notification Config
|--------------------------------------------------------------------------
*/
exports.updateNotificationConfig = Joi.object({
  smsEnabled: Joi.boolean().required(),
  emailEnabled: Joi.boolean().required(),
});

/*
|--------------------------------------------------------------------------
| Update Branding Config
|--------------------------------------------------------------------------
*/
exports.updateBrandingConfig = Joi.object({
  logo: Joi.string().allow(null, ""),
  primaryColor: Joi.string().required(),
});

/*
|--------------------------------------------------------------------------
| Update Maintenance Config
|--------------------------------------------------------------------------
*/
exports.updateMaintenanceConfig = Joi.object({
  enabled: Joi.boolean().required(),
  message: Joi.string().allow("", null),
});
