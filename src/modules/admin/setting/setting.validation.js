const Joi = require("joi");

exports.updateGateway = Joi.object({
  gateway: Joi.string().valid("SELCOM", "MPESA", "AIRTEL").required(),
});
