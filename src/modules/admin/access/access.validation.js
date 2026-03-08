const Joi = require("joi");

const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = {
  adminLoginSchema,
};
