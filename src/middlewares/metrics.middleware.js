const { httpRequestDuration } = require("../utils/metrics");

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.originalUrl,
        status: res.statusCode,
      },
      Date.now() - start,
    );
  });

  next();
};
