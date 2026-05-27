const Joi = require('joi');
const { translate } = require('../utils/i18n');

const normalizeField = (path = []) => {
  return path.filter((item) => item !== 'body').join('.');
};

const getValidationMessageKey = (detail) => {
  const field = normalizeField(detail.path);
  const type = detail.type;

  if (field === 'password' && type === 'string.min') {
    return 'validation.password_min';
  }

  if (field === 'password' && type === 'string.max') {
    return 'validation.password_max';
  }

  if (field === 'password' && type === 'string.pattern.base') {
    return 'validation.password_complexity';
  }

  if (field === 'email' && type === 'string.email') {
    return 'validation.email_invalid';
  }

  if (type === 'any.required') {
    return 'validation.required';
  }

  if (type === 'any.only') {
    return 'validation.invalid_value';
  }

  if (type === 'string.empty') {
    return 'validation.required';
  }

  if (type === 'string.min') {
    return 'validation.string_min';
  }

  if (type === 'string.max') {
    return 'validation.string_max';
  }

  return 'validation.invalid';
};

const validate = (schema) => {
  return (req, res, next) => {
    let validationSchema;

    if (Joi.isSchema(schema)) {
      validationSchema = Joi.object({
        body: schema,
      });
    } else {
      validationSchema = Joi.object({
        body: schema.body || Joi.object({}),
        params: schema.params || Joi.object({}),
        query: schema.query || Joi.object({}),
      });
    }

    const data = {
      body: req.body,
      params: req.params,
      query: req.query,
    };

    const { error, value } = validationSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const locale = req.locale || 'en';

      const errors = error.details.map((detail) => {
        const field = normalizeField(detail.path);
        const messageKey = getValidationMessageKey(detail);

        return {
          field,
          messageKey,
          message: translate(messageKey, locale, {
            field,
            limit: detail.context?.limit,
            value: detail.context?.value,
          }),
        };
      });

      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: errors[0]?.message || translate('validation.failed', locale),
        errors,
      });
    }

    if (value.body) req.body = value.body;
    if (value.params) req.params = value.params;
    if (value.query) req.query = value.query;

    return next();
  };
};

module.exports = validate;
