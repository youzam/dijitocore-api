const express = require("express");

const router = express.Router();

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");

const subscriptionController = require("../../subscription/subscription.controller");
const commerceController = require("./commerce.controller");
const subscriptionValidation = require("../../subscription/subscription.validation");
const validate = require("../../../middlewares/validate.middleware");

router.use(auth);

/*
|--------------------------------------------------------------------------
| TRANSACTIONS & PAYMENTS
|--------------------------------------------------------------------------
*/

router.post(
  "/payments/:id/manual-confirm",
  requirePermission({
    module: "COMMERCE",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  commerceController.manualConfirmPayment,
);

router.post(
  "/payments/:id/reconcile",
  requirePermission({
    module: "COMMERCE",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  commerceController.reconcilePayment,
);

router.get(
  "/payments",
  requirePermission({
    module: "COMMERCE",
    action: "VIEW",
    scope: "SYSTEM",
  }),
  commerceController.getAllPayments,
);

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION PACKAGES
|--------------------------------------------------------------------------
*/

router.get(
  "/packages",
  requirePermission({
    module: "COMMERCE",
    action: "VIEW",
    scope: "SYSTEM",
  }),
  subscriptionController.getPackages,
);

router.post(
  "/packages",
  requirePermission({
    module: "COMMERCE",
    action: "CREATE",
    scope: "SYSTEM",
  }),
  validate(subscriptionValidation.createPackage),
  commerceController.createPackage,
);

router.patch(
  "/packages/:id",
  requirePermission({
    module: "COMMERCE",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(subscriptionValidation.updatePackage),
  commerceController.updatePackage,
);

router.get(
  "/packages/:id/schema",
  requirePermission({
    module: "COMMERCE",
    action: "VIEW",
    scope: "SYSTEM",
  }),
  subscriptionController.getPackageSchema,
);

router.patch(
  "/packages/:id/config",
  requirePermission({
    module: "COMMERCE",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  commerceController.updatePackageConfiguration,
);

module.exports = router;
