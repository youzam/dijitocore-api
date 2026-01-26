const { translate } = require("./i18n");

exports.success = (
  req,
  res,
  data,
  statusCode = 200,
  messageKey = "general.success",
) => {
  return res.status(statusCode).json({
    success: true,
    message: translate(messageKey, req.locale),
    data,
  });
};
