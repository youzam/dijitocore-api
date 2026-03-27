const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| JOB LOGS (QUERY) - PRESERVED
|--------------------------------------------------------------------------
*/

exports.getJobLogs = Joi.object({
  query: Joi.object({
    status: Joi.string().valid("SUCCESS", "FAILED", "PENDING").optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
});

/*
|--------------------------------------------------------------------------
| RETRY JOB - PRESERVED
|--------------------------------------------------------------------------
*/

exports.retryJob = Joi.object({
  params: Joi.object({
    jobId: Joi.number().integer().required(),
  }),
});

/*
|--------------------------------------------------------------------------
| SYSTEM FLAGS (UNIFIED)
|--------------------------------------------------------------------------
*/

// reusable schema
const enabledSchema = Joi.object({
  enabled: Joi.boolean().required(),
});

exports.setMaintenanceMode = Joi.object({
  body: enabledSchema,
});

exports.setEmergencyShutdown = Joi.object({
  body: enabledSchema,
});

exports.setPaymentEnabled = Joi.object({
  body: enabledSchema,
});

exports.setApiWriteEnabled = Joi.object({
  body: enabledSchema,
});

exports.setAuthEnabled = Joi.object({
  body: enabledSchema,
});
