const logger = require("../utils/logger");

module.exports = (req, res, next) => {
  logger.info(
    {
      method: req.method,
      url: req.originalUrl,
      requestId: req.requestId,
    },
    "Incoming request",
  );

  next();
};
