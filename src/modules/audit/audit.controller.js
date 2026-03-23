const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

const auditService = require("./audit.service");

/*
|--------------------------------------------------------------------------
| Get Logs
|--------------------------------------------------------------------------
*/
exports.getTenantAuditLogs = catchAsync(async (req, res) => {
  const data = await auditService.getTenantAuditLogs(req.user, req.query);

  return response.success(res, data, "audit.logs_fetched");
});

/*
|--------------------------------------------------------------------------
| Get Single Log
|--------------------------------------------------------------------------
*/
exports.getTenantAuditLogById = catchAsync(async (req, res) => {
  const data = await auditService.getTenantAuditLogById(
    req.params.id,
    req.user,
  );

  return response.success(res, data, "audit.log_fetched");
});
