const Joi = require("joi");

// =============================
// COMMON QUERY VALIDATION
// =============================
const query = Joi.object({
  startDate: Joi.date().iso().optional(),

  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),

  groupBy: Joi.string().valid("day", "week", "month").default("month"),

  country: Joi.string().optional(),

  packageId: Joi.string().optional(),
});

module.exports = {
  query,
};
