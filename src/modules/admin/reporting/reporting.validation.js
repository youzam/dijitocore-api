const Joi = require("joi");

// =============================
// COMMON REPORT QUERY
// =============================
const baseReportQuery = Joi.object({
  // DATE FILTERS
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),

  // ENTITY FILTERS
  businessId: Joi.string().uuid().optional(),
  packageId: Joi.string().uuid().optional(),
  country: Joi.string().optional(),

  // TRANSACTION FILTERS
  status: Joi.string()
    .valid("PENDING", "SUCCESS", "FAILED", "CANCELLED")
    .optional(),

  type: Joi.string()
    .valid(
      "SUBSCRIPTION",
      "SETUP_FEE",
      "RENEWAL",
      "REFUND",
      "MANUAL_ADJUSTMENT",
      // 🔥 ADD THIS (for async export route)
      "transactions",
      "revenue",
      "refunds",
      "subscriptions",
    )
    .optional(),

  gateway: Joi.string().optional(),

  // PAGINATION
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),

  // EXPORT
  format: Joi.string().valid("csv", "excel", "pdf").optional(),
});

// =============================
// EXPORTS
// =============================
exports.getReport = {
  query: baseReportQuery,
};
