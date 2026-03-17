const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

const operationService = require("./operation.service");

/*
|--------------------------------------------------------------------------
| SYSTEM HEALTH
|--------------------------------------------------------------------------
*/

exports.getSystemHealth = catchAsync(async (req, res) => {
  const data = await operationService.getSystemHealth();

  return response.success(req, res, data, 200, "operations.health_fetched");
});

/*
|--------------------------------------------------------------------------
| DB USAGE
|--------------------------------------------------------------------------
*/

exports.getDbUsage = catchAsync(async (req, res) => {
  const data = await operationService.getDbUsage();

  return response.success(req, res, data, 200, "operations.db_usage_fetched");
});

/*
|--------------------------------------------------------------------------
| STORAGE USAGE
|--------------------------------------------------------------------------
*/

exports.getStorageUsage = catchAsync(async (req, res) => {
  const data = await operationService.getStorageUsage();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.storage_usage_fetched",
  );
});

/*
|--------------------------------------------------------------------------
| API METRICS
|--------------------------------------------------------------------------
*/

exports.getApiMetrics = catchAsync(async (req, res) => {
  const data = await operationService.getApiMetrics();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.api_metrics_fetched",
  );
});

/*
|--------------------------------------------------------------------------
| JOB MONITORING
|--------------------------------------------------------------------------
*/

exports.getJobLogs = catchAsync(async (req, res) => {
  const data = await operationService.getJobLogs(req.query);

  return response.success(req, res, data, 200, "operations.job_logs_fetched");
});

exports.retryFailedJob = catchAsync(async (req, res) => {
  const data = await operationService.retryFailedJob(Number(req.params.jobId));

  return response.success(req, res, data, 200, "operations.job_retried");
});

/*
|--------------------------------------------------------------------------
| WEBHOOK MONITOR
|--------------------------------------------------------------------------
*/

exports.getWebhookStats = catchAsync(async (req, res) => {
  const data = await operationService.getWebhookStats();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.webhook_stats_fetched",
  );
});

/*
|--------------------------------------------------------------------------
| GATEWAY MONITOR
|--------------------------------------------------------------------------
*/

exports.getGatewayStats = catchAsync(async (req, res) => {
  const data = await operationService.getGatewayStats();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.gateway_stats_fetched",
  );
});

/*
|--------------------------------------------------------------------------
| MAINTENANCE MODE
|--------------------------------------------------------------------------
*/

exports.enableMaintenance = catchAsync(async (req, res) => {
  const data = await operationService.enableMaintenance();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.maintenance_enabled",
  );
});

exports.disableMaintenance = catchAsync(async (req, res) => {
  const data = await operationService.disableMaintenance();

  return response.success(
    req,
    res,
    data,
    200,
    "operations.maintenance_disabled",
  );
});

/*
|--------------------------------------------------------------------------
| FEATURE FLAGS
|--------------------------------------------------------------------------
*/

exports.toggleFeatureFlag = catchAsync(async (req, res) => {
  const data = await operationService.toggleFeatureFlag(req.params.flag);

  return response.success(
    req,
    res,
    data,
    200,
    "operations.feature_flag_toggled",
  );
});

/*
|--------------------------------------------------------------------------
| EMERGENCY SHUTDOWN
|--------------------------------------------------------------------------
*/

exports.emergencyShutdown = catchAsync(async (req, res) => {
  const data = await operationService.emergencyShutdown();

  return response.success(req, res, data, 200, "operations.system_shutdown");
});

/*
|--------------------------------------------------------------------------
| OPERATIONS DASHBOARD
|--------------------------------------------------------------------------
*/

exports.getOperationsOverview = catchAsync(async (req, res) => {
  const data = await operationService.getOperationsOverview();

  return response.success(req, res, data, 200, "operations.dashboard_overview");
});

exports.getJobPerformance = catchAsync(async (req, res) => {
  const data = await operationService.getJobPerformance();

  return response.success(req, res, data, 200, "operations.job_performance");
});

exports.getRecentJobs = catchAsync(async (req, res) => {
  const data = await operationService.getRecentJobs();

  return response.success(req, res, data, 200, "operations.recent_jobs");
});

exports.getDeadJobs = catchAsync(async (req, res) => {
  const data = await operationService.getDeadJobs();

  return response.success(req, res, data, 200, "operations.dead_jobs");
});
