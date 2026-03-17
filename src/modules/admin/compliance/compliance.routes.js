const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const requirePermission = require("../../middlewares/permission.middleware");
const validate = require("../../middlewares/validate.middleware");

const controller = require("./compliance.controller");
const validation = require("./compliance.validation");

/*
|--------------------------------------------------------------------------
| Apply Auth Middleware
|--------------------------------------------------------------------------
*/

router.use(auth);

/*
|--------------------------------------------------------------------------
| DATA RETENTION POLICY
|--------------------------------------------------------------------------
*/

router.post(
  "/retention",
  requirePermission({
    module: "compliance",
    action: "create",
    scope: "global",
  }),
  validate(validation.createRetentionPolicy),
  controller.createRetentionPolicy,
);

router.put(
  "/retention/:id",
  requirePermission({
    module: "compliance",
    action: "update",
    scope: "global",
  }),
  validate(validation.updateRetentionPolicy),
  controller.updateRetentionPolicy,
);

router.get(
  "/retention",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.listRetentionPolicies,
);

router.get(
  "/retention/resource",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.getRetentionPolicyByResource,
);

router.patch(
  "/retention/:id/toggle",
  requirePermission({
    module: "compliance",
    action: "update",
    scope: "global",
  }),
  validate(validation.toggleRetentionPolicy),
  controller.toggleRetentionPolicy,
);

/*
|--------------------------------------------------------------------------
| POLICY VERSION
|--------------------------------------------------------------------------
*/

router.get(
  "/retention/:policyId/versions",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.listPolicyVersions,
);

router.get(
  "/versions/:id",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.getPolicyVersionById,
);

/*
|--------------------------------------------------------------------------
| DATA REQUESTS
|--------------------------------------------------------------------------
*/

router.post(
  "/requests",
  requirePermission({
    module: "compliance",
    action: "create",
    scope: "global",
  }),
  validate(validation.createDataRequest),
  controller.createDataRequest,
);

router.get(
  "/requests",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.listDataRequests,
);

router.get(
  "/requests/:id",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.getDataRequestById,
);

router.patch(
  "/requests/:id/approve",
  requirePermission({
    module: "compliance",
    action: "approve",
    scope: "global",
  }),
  controller.approveDataRequest,
);

router.patch(
  "/requests/:id/reject",
  requirePermission({
    module: "compliance",
    action: "approve",
    scope: "global",
  }),
  controller.rejectDataRequest,
);

/*
|--------------------------------------------------------------------------
| PURGE QUEUE
|--------------------------------------------------------------------------
*/

router.get(
  "/purge",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.listPurgeQueue,
);

router.get(
  "/purge/:id",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.getPurgeQueueItem,
);

router.patch(
  "/purge/:id/retry",
  requirePermission({
    module: "compliance",
    action: "update",
    scope: "global",
  }),
  controller.retryPurgeJob,
);

/*
|--------------------------------------------------------------------------
| CONSENT LOGS
|--------------------------------------------------------------------------
*/

router.get(
  "/consent",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.listConsentLogs,
);

router.get(
  "/consent/:id",
  requirePermission({ module: "compliance", action: "read", scope: "global" }),
  controller.getConsentLogById,
);

module.exports = router;
