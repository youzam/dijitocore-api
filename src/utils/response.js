const { translate } = require("./i18n");
const autoAnonymize = require("./autoAnonymize"); // 🔥 NEW

exports.success = (
  req,
  res,
  data,
  statusCode = 200,
  messageKey = "general.success",
) => {
  // 🔥 APPLY ANONYMIZATION (CENTRALIZED)
  const safeData = autoAnonymize(data);

  return res.status(statusCode).json({
    success: true,
    message: translate(messageKey, req.locale),
    data: safeData, // 🔥 REPLACED
  });
};

exports.error = (
  req,
  res,
  error = null,
  statusCode = 500,
  messageKey = "general.error",
) => {
  // 🔥 OPTIONAL SAFE ERROR MESSAGE (avoid leaking internals)
  const safeError =
    process.env.NODE_ENV === "production" ? undefined : error?.message || error;

  return res.status(statusCode).json({
    success: false,
    message: translate(messageKey, req.locale),
    error: safeError, // only visible in non-production
  });
};
