const express = require('express');
const router = express.Router();

const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validate = require('../../../middlewares/validate.middleware');

const controller = require('./compliance.controller');
const validation = require('./compliance.validation');

const PERMISSIONS = require('../../../utils/permission.constants');

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
  '/retention',
  requirePermission(PERMISSIONS.COMPLIANCE_RETENTIONPOLICY_CREATE_SYSTEM),
  validate(validation.createRetentionPolicy),
  controller.createRetentionPolicy,
);

router.put(
  '/retention/:id',
  requirePermission(PERMISSIONS.COMPLIANCE_RETENTIONPOLICY_UPDATE_SYSTEM),
  validate(validation.updateRetentionPolicy),
  controller.updateRetentionPolicy,
);

router.get(
  '/retention',
  requirePermission(PERMISSIONS.COMPLIANCE_RETENTIONPOLICY_READ_SYSTEM),
  controller.listRetentionPolicies,
);

router.get(
  '/retention/resource',
  requirePermission(
    PERMISSIONS.COMPLIANCE_RETENTIONPOLICYBYRESOURCE_READ_SYSTEM,
  ),
  controller.getRetentionPolicyByResource,
);

router.patch(
  '/retention/:id/toggle',
  requirePermission(
    PERMISSIONS.COMPLIANCE_RETENTIONPOLICYTOGGLE_EXECUTE_SYSTEM,
  ),
  validate(validation.toggleRetentionPolicy),
  controller.toggleRetentionPolicy,
);

/*
|--------------------------------------------------------------------------
| POLICY VERSION
|--------------------------------------------------------------------------
*/

router.get(
  '/retention/:policyId/versions',
  requirePermission(PERMISSIONS.COMPLIANCE_POLICYVERSION_READ_SYSTEM),
  controller.listPolicyVersions,
);

router.get(
  '/versions/:id',
  requirePermission(PERMISSIONS.COMPLIANCE_POLICYVERSIONBYID_READ_SYSTEM),
  controller.getPolicyVersionById,
);

/*
|--------------------------------------------------------------------------
| DATA REQUESTS
|--------------------------------------------------------------------------
*/

router.get(
  '/requests',
  requirePermission(PERMISSIONS.COMPLIANCE_DATAREQUEST_READ_SYSTEM),
  controller.listDataRequests,
);

router.get(
  '/requests/:id',
  requirePermission(PERMISSIONS.COMPLIANCE_DATAREQUESTBYID_READ_SYSTEM),
  controller.getDataRequestById,
);

router.patch(
  '/requests/:id/approve',
  requirePermission(PERMISSIONS.COMPLIANCE_DATAREQUESTAPPROVE_EXECUTE_SYSTEM),
  controller.approveDataRequest,
);

router.patch(
  '/requests/:id/reject',
  requirePermission(PERMISSIONS.COMPLIANCE_DATAREQUESTREJECT_EXECUTE_SYSTEM),
  controller.rejectDataRequest,
);

/*
|--------------------------------------------------------------------------
| PURGE QUEUE
|--------------------------------------------------------------------------
*/

router.get(
  '/purge',
  requirePermission(PERMISSIONS.COMPLIANCE_PURGEJOB_READ_SYSTEM),
  controller.listPurgeQueue,
);

router.get(
  '/purge/:id',
  requirePermission(PERMISSIONS.COMPLIANCE_PURGEJOBBYID_READ_SYSTEM),
  controller.getPurgeQueueItem,
);

router.patch(
  '/purge/:id/retry',
  requirePermission(PERMISSIONS.COMPLIANCE_PURGEJOBRETRY_EXECUTE_SYSTEM),
  controller.retryPurgeJob,
);

/*
|--------------------------------------------------------------------------
| CONSENT LOGS
|--------------------------------------------------------------------------
*/

router.get(
  '/consent',
  requirePermission(PERMISSIONS.COMPLIANCE_CONSENTLOG_READ_SYSTEM),
  controller.listConsentLogs,
);

router.get(
  '/consent/:id',
  requirePermission(PERMISSIONS.COMPLIANCE_CONSENTLOGBYID_READ_SYSTEM),
  controller.getConsentLogById,
);

router.get(
  '/requests/:id/download',
  requirePermission(PERMISSIONS.COMPLIANCE_EXPORTDOWNLOAD_EXECUTE_SYSTEM),
  controller.downloadExport,
);

module.exports = router;
