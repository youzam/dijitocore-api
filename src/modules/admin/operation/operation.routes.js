const express = require('express');

const controller = require('./operation.controller');
const validate = require('../../../middlewares/validate.middleware');
const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');

const validation = require('./operation.validation');
const PERMISSIONS = require('../../../utils/permission.constants');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GLOBAL AUTH
|--------------------------------------------------------------------------
*/
router.use(auth);

/*
|--------------------------------------------------------------------------
| SYSTEM HEALTH & METRICS
|--------------------------------------------------------------------------
*/

router.get(
  '/health',
  requirePermission(PERMISSIONS.OPERATION_SYSTEMHEALTH_READ_SYSTEM),
  controller.getSystemHealth,
);

router.get(
  '/db-usage',
  requirePermission(PERMISSIONS.OPERATION_DBUSAGE_READ_SYSTEM),
  controller.getDbUsage,
);

router.get(
  '/storage-usage',
  requirePermission(PERMISSIONS.OPERATION_STORAGEUSAGE_READ_SYSTEM),
  controller.getStorageUsage,
);

router.get(
  '/api-metrics',
  requirePermission(PERMISSIONS.OPERATION_APIMETRICS_READ_SYSTEM),
  controller.getApiMetrics,
);

/*
|--------------------------------------------------------------------------
| JOB MONITORING
|--------------------------------------------------------------------------
*/

router.get(
  '/jobs',
  requirePermission(PERMISSIONS.OPERATION_JOBLOG_READ_SYSTEM),
  validate(validation.getJobLogs),
  controller.getJobLogs,
);

router.post(
  '/jobs/:jobId/retry',
  requirePermission(PERMISSIONS.OPERATION_JOBRETRY_EXECUTE_SYSTEM),
  validate(validation.retryJob),
  controller.retryFailedJob,
);

/*
|--------------------------------------------------------------------------
| WEBHOOK & GATEWAY MONITORING
|--------------------------------------------------------------------------
*/

router.get(
  '/webhooks',
  requirePermission(PERMISSIONS.OPERATION_WEBHOOKSTATS_READ_SYSTEM),
  controller.getWebhookStats,
);

router.get(
  '/gateways',
  requirePermission(PERMISSIONS.OPERATION_GATEWAYSTATS_READ_SYSTEM),
  controller.getGatewayStats,
);

/*
|--------------------------------------------------------------------------
| MAINTENANCE MODE
|--------------------------------------------------------------------------
*/

router.post(
  '/feature/maintenance',
  requirePermission(PERMISSIONS.OPERATION_MAINTENANCE_EXECUTE_SYSTEM),
  validate(validation.setMaintenanceMode),
  controller.setMaintenanceMode,
);

/*
|--------------------------------------------------------------------------
| EMERGENCY
|--------------------------------------------------------------------------
*/

router.post(
  '/feature/shutdown',
  requirePermission(PERMISSIONS.OPERATION_SHUTDOWN_EXECUTE_SYSTEM),
  validate(validation.setEmergencyShutdown),
  controller.setEmergencyShutdown,
);

/*
|--------------------------------------------------------------------------
| OTHER FEATURE FLAGS
|--------------------------------------------------------------------------
*/

router.post(
  '/feature/subscription-payments',
  requirePermission(PERMISSIONS.OPERATION_PAYMENTTOGGLE_EXECUTE_SYSTEM),
  controller.setPaymentEnabled,
);

router.post(
  '/feature/api-write',
  requirePermission(PERMISSIONS.OPERATION_APITOGGLE_EXECUTE_SYSTEM),
  controller.setApiWriteEnabled,
);

router.post(
  '/feature/auth',
  requirePermission(PERMISSIONS.OPERATION_AUTHTOGGLE_EXECUTE_SYSTEM),
  controller.setAuthEnabled,
);

/*
|--------------------------------------------------------------------------
| OPERATIONS DASHBOARD
|--------------------------------------------------------------------------
*/

router.get(
  '/dashboard/overview',
  requirePermission(PERMISSIONS.OPERATION_OVERVIEW_READ_SYSTEM),
  controller.getOperationsOverview,
);

router.get(
  '/dashboard/performance',
  requirePermission(PERMISSIONS.OPERATION_JOBPERFORMANCE_READ_SYSTEM),
  controller.getJobPerformance,
);

router.get(
  '/dashboard/recent',
  requirePermission(PERMISSIONS.OPERATION_RECENTJOBS_READ_SYSTEM),
  controller.getRecentJobs,
);

router.get(
  '/dashboard/dead-jobs',
  requirePermission(PERMISSIONS.OPERATION_DEADJOBS_READ_SYSTEM),
  controller.getDeadJobs,
);

/*
|--------------------------------------------------------------------------
| PERMISSION SYNC (ULIYOONGEZA)
|--------------------------------------------------------------------------
*/

router.post(
  '/permissions/sync',
  requirePermission(PERMISSIONS.OPERATION_PERMISSIONSYNC_EXECUTE_SYSTEM),
  controller.syncPermissions,
);

module.exports = router;
