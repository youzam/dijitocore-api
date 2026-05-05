const { translate } = require("./i18n");
const autoAnonymize = require("./autoAnonymize");
const env = require("../config/env");

// 🔹 BASE SUCCESS (UNCHANGED + META SUPPORT)
exports.success = (
  req,
  res,
  data,
  statusCode = 200,
  messageKey = "general.success",
  meta = {},
) => {
  // 🔥 APPLY ANONYMIZATION (CENTRALIZED)
  const safeData = autoAnonymize(data);

  return res.status(statusCode).json({
    success: true,
    message: translate(messageKey, req.locale),

    ...meta, // 🔥 supports pagination / extra info

    data: safeData,
  });
};

// 🔹 ERROR (UNCHANGED)
exports.error = (
  req,
  res,
  error = null,
  statusCode = 500,
  messageKey = "general.error",
) => {
  const safeError =
    env.NODE_ENV === "production" ? undefined : error?.message || error;

  return res.status(statusCode).json({
    success: false,
    message: translate(messageKey, req.locale),
    error: safeError,
  });
};

// 🔹 SINGLE ITEM
exports.successItem = (
  req,
  res,
  data,
  messageKey = "general.success",
  statusCode = 200,
) => {
  return exports.success(req, res, data, statusCode, messageKey);
};

// 🔹 EMPTY RESPONSE (e.g. delete)
exports.successEmpty = (
  req,
  res,
  messageKey = "general.success",
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message: translate(messageKey, req.locale),
    data: null,
  });
};

// 🔹 LIST (no pagination)
exports.successList = (
  req,
  res,
  data,
  messageKey = "general.success",
  statusCode = 200,
) => {
  return exports.success(req, res, data, statusCode, messageKey, {
    results: data.length,
  });
};

// 🔹 PAGINATED LIST
exports.successPaginated = (
  req,
  res,
  data,
  meta,
  messageKey = "general.success",
  statusCode = 200,
) => {
  return exports.success(req, res, data, statusCode, messageKey, {
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
    results: meta.results ?? data.length,
  });
};
