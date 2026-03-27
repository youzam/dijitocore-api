const express = require("express");

const controller = require("./operation.controller");
const validate = require("../../../middlewares/validate.middleware");
const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");

const validation = require("./operation.validation");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GLOBAL AUTH (ADMIN PATTERN)
|--------------------------------------------------------------------------
*/
router.use(auth);

/*
|--------------------------------------------------------------------------
| SYSTEM HEALTH & METRICS
|--------------------------------------------------------------------------
*/

router.get(
  "/health",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getSystemHealth,
);

router.get(
  "/db-usage",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getDbUsage,
);

router.get(
  "/storage-usage",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getStorageUsage,
);

router.get(
  "/api-metrics",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getApiMetrics,
);

/*
|--------------------------------------------------------------------------
| JOB MONITORING
|--------------------------------------------------------------------------
*/

router.get(
  "/jobs",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  validate(validation.getJobLogs),
  controller.getJobLogs,
);

router.post(
  "/jobs/:jobId/retry",
  requirePermission({
    module: "operations",
    action: "execute",
    scope: "global",
  }),
  validate(validation.retryJob),
  controller.retryFailedJob,
);

/*
|--------------------------------------------------------------------------
| WEBHOOK & GATEWAY MONITORING
|--------------------------------------------------------------------------
*/

router.get(
  "/webhooks",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getWebhookStats,
);

router.get(
  "/gateways",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getGatewayStats,
);

/*
|--------------------------------------------------------------------------
| MAINTENANCE MODE
|--------------------------------------------------------------------------
*/
router.post(
  "//feature/maintenance",
  requirePermission({
    module: "operations",
    action: "manage",
    scope: "global",
  }),
  validate(validation.setMaintenanceMode), // optional kama unaongeza validation
  controller.setMaintenanceMode,
);

/*
|--------------------------------------------------------------------------
| EMERGENCY
|--------------------------------------------------------------------------
*/
router.post(
  "//feature/shutdown",
  requirePermission({
    module: "operations",
    action: "manage",
    scope: "global",
  }),
  validate(validation.setEmergencyShutdown),
  controller.setEmergencyShutdown,
);

/*
|--------------------------------------------------------------------------
| OTHER FEATURE FLAGS
|--------------------------------------------------------------------------
*/
router.post(
  "/feature/subscription-payments",
  requirePermission({
    module: "operations",
    action: "manage",
    scope: "global",
  }),
  controller.setPaymentEnabled,
);

router.post(
  "//feature/api-write",
  requirePermission({
    module: "operations",
    action: "manage",
    scope: "global",
  }),
  controller.setApiWriteEnabled,
);

router.post(
  "/feature/auth",
  requirePermission({
    module: "operations",
    action: "manage",
    scope: "global",
  }),
  controller.setAuthEnabled,
);

/*
|--------------------------------------------------------------------------
| OPERATIONS DASHBOARD
|--------------------------------------------------------------------------
*/

router.get(
  "/dashboard/overview",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getOperationsOverview,
);

router.get(
  "/dashboard/performance",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getJobPerformance,
);

router.get(
  "/dashboard/recent",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getRecentJobs,
);

router.get(
  "/dashboard/dead-jobs",
  requirePermission({
    module: "operations",
    action: "read",
    scope: "global",
  }),
  controller.getDeadJobs,
);

module.exports = router;
