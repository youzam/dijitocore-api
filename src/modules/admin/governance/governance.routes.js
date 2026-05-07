const express = require('express');

const governanceController = require('./governance.controller');
const requirePermission = require('../../../middlewares/permission.middleware');
const auth = require('../../../middlewares/auth.middleware');

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
| BUSINESS STATUS
|--------------------------------------------------------------------------
*/

router.post(
  '/businesses/:businessId/activate',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSACTIVATE_EXECUTE_SYSTEM),
  governanceController.activateBusiness,
);

router.post(
  '/businesses/:businessId/grace',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSGRACE_EXECUTE_SYSTEM),
  governanceController.moveToGrace,
);

router.post(
  '/businesses/:businessId/suspend',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSSUSPEND_EXECUTE_SYSTEM),
  governanceController.suspendBusiness,
);

router.post(
  '/businesses/:businessId/terminate',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSTERMINATE_EXECUTE_SYSTEM),
  governanceController.terminateBusiness,
);

/*
|--------------------------------------------------------------------------
| BUSINESS GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  '/businesses',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESS_READ_SYSTEM),
  governanceController.listBusinesses,
);

router.get(
  '/businesses/:businessId/timeline',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSTIMELINE_READ_SYSTEM),
  governanceController.getBusinessTimeline,
);

router.get(
  '/businesses/:businessId/revenue',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSREVENUE_READ_SYSTEM),
  governanceController.getBusinessRevenueSummary,
);

router.patch(
  '/businesses/:businessId/change-subscription',
  requirePermission(
    PERMISSIONS.GOVERNANCE_BUSINESSSUBSCRIPTIONCHANGE_EXECUTE_SYSTEM,
  ),
  governanceController.changeBusinessSubscription,
);

router.patch(
  '/businesses/:businessId/extend-grace',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSGRACEEXTEND_EXECUTE_SYSTEM),
  governanceController.extendBusinessGracePeriod,
);

/*
|--------------------------------------------------------------------------
| USER GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  '/users',
  requirePermission(PERMISSIONS.GOVERNANCE_USER_READ_SYSTEM),
  governanceController.listUsers,
);

router.patch(
  '/users/:userId/lock',
  requirePermission(PERMISSIONS.GOVERNANCE_USERLOCK_EXECUTE_SYSTEM),
  governanceController.lockUser,
);

router.patch(
  '/users/:userId/unlock',
  requirePermission(PERMISSIONS.GOVERNANCE_USERUNLOCK_EXECUTE_SYSTEM),
  governanceController.unlockUser,
);

router.patch(
  '/users/:userId/status',
  requirePermission(PERMISSIONS.GOVERNANCE_USERSTATUS_UPDATE_SYSTEM),
  governanceController.updateUserStatus,
);

router.post(
  '/users/:userId/reset-password',
  requirePermission(PERMISSIONS.GOVERNANCE_USERPASSWORDRESET_EXECUTE_SYSTEM),
  governanceController.resetUserPassword,
);

router.post(
  '/users/:userId/force-logout',
  requirePermission(PERMISSIONS.GOVERNANCE_USERFORCELOGOUT_EXECUTE_SYSTEM),
  governanceController.forceLogoutUser,
);

router.post(
  '/users/:userId/impersonate',
  requirePermission(PERMISSIONS.GOVERNANCE_USERIMPERSONATE_EXECUTE_SYSTEM),
  governanceController.impersonateUser,
);

/*
|--------------------------------------------------------------------------
| CUSTOMER GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  '/customers/:customerId',
  requirePermission(PERMISSIONS.GOVERNANCE_CUSTOMER_READ_SYSTEM),
  governanceController.getCustomerSummary,
);

router.patch(
  '/customers/:customerId/blacklist',
  requirePermission(PERMISSIONS.GOVERNANCE_CUSTOMERBLACKLIST_EXECUTE_SYSTEM),
  governanceController.blacklistCustomer,
);

router.patch(
  '/customers/:customerId/unblacklist',
  requirePermission(PERMISSIONS.GOVERNANCE_CUSTOMERUNBLACKLIST_EXECUTE_SYSTEM),
  governanceController.unblacklistCustomer,
);

router.get(
  '/businesses/:businessId',
  requirePermission(PERMISSIONS.GOVERNANCE_BUSINESSPROFILE_READ_SYSTEM),
  governanceController.getBusinessProfile,
);

/*
|--------------------------------------------------------------------------
| SYSTEM GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  '/audit-logs',
  requirePermission(PERMISSIONS.GOVERNANCE_AUDITLOG_READ_SYSTEM),
  governanceController.listAdminAuditLogs,
);

router.get(
  '/risk-flags',
  requirePermission(PERMISSIONS.GOVERNANCE_RISK_READ_SYSTEM),
  governanceController.getRiskFlags,
);

router.get(
  '/search',
  requirePermission(PERMISSIONS.GOVERNANCE_SEARCH_READ_SYSTEM),
  governanceController.globalSearch,
);

/*
|--------------------------------------------------------------------------
| BULK USER ACTIONS
|--------------------------------------------------------------------------
*/

router.post(
  '/users/lock',
  requirePermission(PERMISSIONS.GOVERNANCE_USERLOCK_EXECUTE_SYSTEM),
  governanceController.lockUser,
);

router.post(
  '/users/unlock',
  requirePermission(PERMISSIONS.GOVERNANCE_USERUNLOCK_EXECUTE_SYSTEM),
  governanceController.unlockUser,
);

module.exports = router;
