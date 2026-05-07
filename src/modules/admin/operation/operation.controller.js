const catchAsync = require('../../../utils/catchAsync');
const response = require('../../../utils/response');
const handlerFactory = require('../../../utils/handlerFactory');
const operationService = require('./operation.service');

/*
|--------------------------------------------------------------------------
| SYSTEM HEALTH
|--------------------------------------------------------------------------
*/

exports.getSystemHealth = catchAsync(async (req, res) => {
  const data = await operationService.getSystemHealth();

  return response.success(req, res, data, 200, 'operations.health_fetched');
});

/*
|--------------------------------------------------------------------------
| DB USAGE
|--------------------------------------------------------------------------
*/

exports.getDbUsage = catchAsync(async (req, res) => {
  const data = await operationService.getDbUsage();

  return response.success(req, res, data, 200, 'operations.db_usage_fetched');
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
    'operations.storage_usage_fetched',
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
    'operations.api_metrics_fetched',
  );
});

/*
|--------------------------------------------------------------------------
| JOB MONITORING
|--------------------------------------------------------------------------
*/

exports.getJobLogs = handlerFactory.getAll('systemJobLog');

exports.retryFailedJob = catchAsync(async (req, res) => {
  const data = await operationService.retryFailedJob(Number(req.params.jobId));

  return response.success(req, res, data, 200, 'operations.job_retried');
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
    'operations.webhook_stats_fetched',
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
    'operations.gateway_stats_fetched',
  );
});

/*
|--------------------------------------------------------------------------
| MAINTENANCE MODE
|--------------------------------------------------------------------------
*/
exports.setMaintenanceMode = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  const data = await operationService.setMaintenanceMode(enabled);

  return response.success(
    req,
    res,
    data,
    200,
    enabled
      ? 'operations.maintenance_enabled'
      : 'operations.maintenance_disabled',
  );
});

exports.setEmergencyShutdown = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  const data = await operationService.setEmergencyShutdown(enabled);

  return response.success(
    req,
    res,
    data,
    200,
    enabled ? 'operations.system_shutdown' : 'operations.system_restored',
  );
});

exports.setPaymentEnabled = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  const data = await operationService.setPaymentEnabled(enabled);

  return response.success(
    req,
    res,
    data,
    200,
    'operations.payment_flag_updated',
  );
});

exports.setApiWriteEnabled = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  const data = await operationService.setApiWriteEnabled(enabled);

  return response.success(
    req,
    res,
    data,
    200,
    'operations.api_write_flag_updated',
  );
});

exports.setAuthEnabled = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  const data = await operationService.setAuthEnabled(enabled);

  return response.success(req, res, data, 200, 'operations.auth_flag_updated');
});

/*
|--------------------------------------------------------------------------
| OPERATIONS DASHBOARD
|--------------------------------------------------------------------------
*/

exports.getOperationsOverview = catchAsync(async (req, res) => {
  const data = await operationService.getOperationsOverview();

  return response.success(req, res, data, 200, 'operations.dashboard_overview');
});

exports.getJobPerformance = catchAsync(async (req, res) => {
  const data = await operationService.getJobPerformance();

  return response.success(req, res, data, 200, 'operations.job_performance');
});

exports.getRecentJobs = handlerFactory.getAll('systemJobLog');

exports.getDeadJobs = handlerFactory.getAll('deadJob');

exports.syncPermissions = catchAsync(async (req, res) => {
  const result = await operationService.syncPermissions();

  return response.success(req, res, result, 200);
});
