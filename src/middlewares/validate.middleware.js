const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    let validationSchema;

    /*
    |--------------------------------------------------------------------------
    | Support BOTH Patterns (Backward Compatible)
    |--------------------------------------------------------------------------
    | 1. Joi.object({...})                    → body only (legacy)
    | 2. { body, params, query }             → full validation (new)
    */

    if (schema instanceof Joi.ObjectSchema) {
      // legacy (body only)
      validationSchema = Joi.object({
        body: schema,
      });
    } else {
      // new enterprise pattern
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
      const errors = error.details.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Attach sanitized values back to request
    |--------------------------------------------------------------------------
    */

    req.body = value.body;
    req.params = value.params;
    req.query = value.query;

    return next();
  };
};

module.exports = validate;
