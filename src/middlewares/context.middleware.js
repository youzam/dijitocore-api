const { runWithContext } = require("../utils/requestContext");

module.exports = (req, res, next) => {
  runWithContext(
    {
      user: req.user || null,
    },
    () => next(),
  );
};
