const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| DATA RETENTION POLICY
|--------------------------------------------------------------------------
*/

const createRetentionPolicy = Joi.object({
  resource: Joi.string().trim().required(),
  retentionDays: Joi.number().integer().min(1).required(),
});

const updateRetentionPolicy = Joi.object({
  retentionDays: Joi.number().integer().min(1).required(),
});

const toggleRetentionPolicy = Joi.object({
  isActive: Joi.boolean().required(),
});

/*
|--------------------------------------------------------------------------
| DATA REQUESTS (EXPORT + DELETE)
|--------------------------------------------------------------------------
*/

const createDataRequest = Joi.object({
  type: Joi.string().valid("EXPORT", "DELETE").required(),
  targetType: Joi.string().trim().required(),
  targetId: Joi.string().trim().required(),
  reason: Joi.string().allow("", null),
});

/*
|--------------------------------------------------------------------------
| QUERY VALIDATIONS
|--------------------------------------------------------------------------
*/

const listRetentionPolicies = Joi.object({
  resource: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});

const listDataRequests = Joi.object({
  type: Joi.string().valid("EXPORT", "DELETE").optional(),
  status: Joi.string()
    .valid(
      "PENDING",
      "APPROVED",
      "REJECTED",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
    )
    .optional(),
});

const listPurgeQueue = Joi.object({
  status: Joi.string()
    .valid("PENDING", "PROCESSING", "COMPLETED", "FAILED")
    .optional(),
});

const listConsentLogs = Joi.object({
  userId: Joi.string().optional(),
  businessId: Joi.string().optional(),
  type: Joi.string().optional(),
});

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  createRetentionPolicy,
  updateRetentionPolicy,
  toggleRetentionPolicy,

  createDataRequest,

  listRetentionPolicies,
  listDataRequests,
  listPurgeQueue,
  listConsentLogs,
};
