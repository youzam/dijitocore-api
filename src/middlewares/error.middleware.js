const { translate } = require('../utils/i18n');
const AppError = require('../utils/AppError');

module.exports = (err, req, res, _next) => {
  let error = err;

  /**
   * 🔥 NORMALIZE ERROR
   */
  if (!(error instanceof AppError)) {
    error = new AppError(
      error.message || 'internal.server_error',
      error.statusCode || 500,
    );
  }

  /**
   * 🌍 MESSAGE
   */
  let message = error.messageKey || error.message;

  try {
    message = translate(message, req.locale || 'en');
  } catch {
    // silent fallback
  }

  /**
   * 📦 RESPONSE
   */
  const response = {
    status: 'error',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    message,
  };

  /**
   * 🐞 DEBUG MODE
   */
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
};
