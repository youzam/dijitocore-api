const { translate } = require("../utils/i18n");

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  let message = err.message;

  // Translate i18n keys
  try {
    message = translate(err.message, req.locale || "en");
  } catch (e) {
    message = err.message;
  }

  res.status(statusCode).json({
    status: "error",
    message,
  });
};
