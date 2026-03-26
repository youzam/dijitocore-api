const express = require("express");

const governanceController = require("./governance.controller");
const requirePermission = require("../../../middlewares/permission.middleware");
const auth = require("../../../middlewares/auth.middleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GLOBAL AUTH PROTECTION
|--------------------------------------------------------------------------
| All governance routes require authentication first
*/
router.use(auth);
/*
|--------------------------------------------------------------------------
| EXISTING BUSINESS STATUS ROUTES (UNCHANGED)
|--------------------------------------------------------------------------
*/

router.post(
  "/businesses/:businessId/activate",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.activateBusiness,
);

router.post(
  "/businesses/:businessId/grace",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.moveToGrace,
);

router.post(
  "/businesses/:businessId/suspend",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.suspendBusiness,
);

router.post(
  "/businesses/:businessId/terminate",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.terminateBusiness,
);

/*
|--------------------------------------------------------------------------
| BUSINESS GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  "/businesses",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "BUSINESS",
  }),
  governanceController.listBusinesses,
);

router.get(
  "/businesses/:businessId/timeline",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "BUSINESS",
  }),
  governanceController.getBusinessTimeline,
);

router.get(
  "/businesses/:businessId/revenue",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "BUSINESS",
  }),
  governanceController.getBusinessRevenueSummary,
);

router.patch(
  "/businesses/:businessId/change-subscription",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.changeBusinessSubscription,
);

router.patch(
  "/businesses/:businessId/extend-grace",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  governanceController.extendBusinessGracePeriod,
);

/*
|--------------------------------------------------------------------------
| USER GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  "/users",
  requirePermission({ module: "GOVERNANCE", action: "VIEW", scope: "USER" }),
  governanceController.listUsers,
);

router.patch(
  "/users/:userId/lock",
  requirePermission({ module: "GOVERNANCE", action: "EDIT", scope: "USER" }),
  governanceController.lockUser,
);

router.patch(
  "/users/:userId/unlock",
  requirePermission({ module: "GOVERNANCE", action: "EDIT", scope: "USER" }),
  governanceController.unlockUser,
);

router.patch(
  "/users/:userId/status",
  requirePermission({
    module: "GOVERNANCE",
    action: "UPDATE",
    scope: "USER",
  }),
  governanceController.updateUserStatus,
);

router.post(
  "/users/:userId/reset-password",
  requirePermission({ module: "GOVERNANCE", action: "EDIT", scope: "USER" }),
  governanceController.resetUserPassword,
);

router.post(
  "/users/:userId/force-logout",
  requirePermission({ module: "GOVERNANCE", action: "EDIT", scope: "USER" }),
  governanceController.forceLogoutUser,
);

router.post(
  "/users/:userId/impersonate",
  requirePermission({ module: "GOVERNANCE", action: "EDIT", scope: "USER" }),
  governanceController.impersonateUser,
);

/*
|--------------------------------------------------------------------------
| CUSTOMER GOVERNANCE
|--------------------------------------------------------------------------
*/

router.get(
  "/customers/:customerId",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "CUSTOMER",
  }),
  governanceController.getCustomerSummary,
);

router.patch(
  "/customers/:customerId/blacklist",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "CUSTOMER",
  }),
  governanceController.blacklistCustomer,
);

router.patch(
  "/customers/:customerId/unblacklist",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "CUSTOMER",
  }),
  governanceController.unblacklistCustomer,
);

router.get(
  "/businesses/:businessId",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "BUSINESS",
  }),
  governanceController.getBusinessProfile,
);

router.get(
  "/audit-logs",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "AUDIT",
  }),
  governanceController.listAdminAuditLogs,
);

router.get(
  "/risk-flags",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "RISK",
  }),
  governanceController.getRiskFlags,
);

router.get(
  "/search",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "SEARCH",
  }),
  governanceController.globalSearch,
);

module.exports = router;
