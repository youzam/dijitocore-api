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
