const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| JOB LOGS (QUERY)
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
| RETRY JOB
|--------------------------------------------------------------------------
*/

exports.retryJob = Joi.object({
  params: Joi.object({
    jobId: Joi.number().integer().required(),
  }),
});

/*
|--------------------------------------------------------------------------
| FEATURE FLAG TOGGLE
|--------------------------------------------------------------------------
*/

exports.toggleFeatureFlag = Joi.object({
  params: Joi.object({
    flag: Joi.string()
      .valid(
        "MAINTENANCE_MODE",
        "PAYMENTS_ENABLED",
        "NOTIFICATIONS_ENABLED",
        "JOB_PROCESSING_ENABLED",
        "WEBHOOK_PROCESSING_ENABLED",
        "API_WRITE_ENABLED",
      )
      .required(),
  }),
});
