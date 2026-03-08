const express = require("express");

const router = express.Router();

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");
const governanceController = require("./governance.controller");
const contractController = require("../../contract/contract.controller");
const businessController = require("../../business/business.controller");

router.use(auth);

/*
|--------------------------------------------------------------------------
| BUSINESS GOVERNANCE
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

router.get(
  "/businesses/:businessId",
  requirePermission({
    module: "GOVERNANCE",
    action: "VIEW",
    scope: "BUSINESS",
  }),
  businessController.getBusinessDetails,
);

router.patch(
  "/contracts/:id/terminate",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  contractController.terminateContract,
);
router.post(
  "/business-users/:userId/activate",
  requirePermission({
    module: "GOVERNANCE",
    action: "EDIT",
    scope: "BUSINESS",
  }),
  businessController.activateBusinessUser,
);

module.exports = router;
