const Joi = require("joi");

exports.createContract = Joi.object({
  customerId: Joi.string().uuid().required(),
  title: Joi.string().required(),
  description: Joi.string().allow("", null),

  assets: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),

  totalValue: Joi.number().integer().min(1).required(),
  downPayment: Joi.number().integer().min(0).required(),
  installmentAmount: Joi.number().integer().min(1).required(),

  frequency: Joi.string()
    .valid("DAILY", "WEEKLY", "MONTHLY", "CUSTOM")
    .required(),

  customDays: Joi.when("frequency", {
    is: "CUSTOM",
    then: Joi.number().integer().min(1).required(),
    otherwise: Joi.forbidden(),
  }),

  startDate: Joi.date().required(),
});

exports.updateContract = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().allow("", null).optional(),
});

exports.terminateContract = Joi.object({
  reason: Joi.string().required(),
});

/* ================= APPROVAL ================= */

exports.approveTermination = Joi.object({
  approvalId: Joi.string().uuid().required(),
});

exports.rejectTermination = Joi.object({
  approvalId: Joi.string().uuid().required(),
});
