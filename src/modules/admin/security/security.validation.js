const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| Reusable
|--------------------------------------------------------------------------
*/

const uuid = Joi.string().uuid();

/*
|--------------------------------------------------------------------------
| Pagination (USED ACROSS MODULE)
|--------------------------------------------------------------------------
*/

exports.paginationQuery = Joi.object({
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Login Activity
|--------------------------------------------------------------------------
*/

exports.getLoginActivities = Joi.object({
  userId: uuid.optional(),
  adminId: uuid.optional(),
  page: Joi.number().optional(),
  limit: Joi.number().optional(),
});

/*
|--------------------------------------------------------------------------
| Audit Logs
|--------------------------------------------------------------------------
*/

exports.getAuditLogs = Joi.object({
  adminId: uuid.optional(),
  action: Joi.string().optional(),
  page: Joi.number().optional(),
  limit: Joi.number().optional(),
});

exports.auditIdParam = Joi.object({
  id: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| User Sessions
|--------------------------------------------------------------------------
*/

exports.userIdParam = Joi.object({
  userId: uuid.required(),
});

exports.tokenIdParam = Joi.object({
  tokenId: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| Admin Sessions
|--------------------------------------------------------------------------
*/

exports.adminIdParam = Joi.object({
  adminId: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| Fraud Flags
|--------------------------------------------------------------------------
*/

exports.flagUser = Joi.object({
  userId: uuid.required(),
  reason: Joi.string().min(3).required(),
});

exports.flagTransaction = Joi.object({
  transactionId: uuid.required(),
  reason: Joi.string().min(3).required(),
});

exports.flagIdParam = Joi.object({
  flagId: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| Suspicious Transactions
|--------------------------------------------------------------------------
*/

exports.transactionIdParam = Joi.object({
  transactionId: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| System Error Logging
|--------------------------------------------------------------------------
*/

exports.logSystemError = Joi.object({
  message: Joi.string().required(),
  stack: Joi.string().optional(),
});

/*
|--------------------------------------------------------------------------
| Security Incidents
|--------------------------------------------------------------------------
*/

exports.getIncidentsQuery = Joi.object({
  type: Joi.string()
    .valid(
      "FRAUD",
      "SUSPICIOUS_TRANSACTION",
      "LOGIN_ANOMALY",
      "SYSTEM_INTEGRITY",
    )
    .optional(),

  status: Joi.string().valid("OPEN", "IN_PROGRESS", "RESOLVED").optional(),

  severity: Joi.string().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").optional(),

  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
});

exports.incidentIdParam = Joi.object({
  id: Joi.string().uuid().required(),
});

exports.updateIncidentStatus = Joi.object({
  status: Joi.string().valid("IN_PROGRESS", "RESOLVED").required(),
});
