const express = require("express");
const router = express.Router();

const subscriptionController = require("./subscription.controller");
const subscriptionValidation = require("./subscription.validation");

const validate = require("../../middlewares/validate.middleware");
const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");

/* ===========================
   BUSINESS ROUTES
   =========================== */

/* CREATE SUBSCRIPTION */
router.post(
  "/",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  validate(subscriptionValidation.createSubscription),
  subscriptionController.createSubscription,
);

/* UPGRADE SUBSCRIPTION */
router.post(
  "/:id/upgrade",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  validate(subscriptionValidation.upgradeSubscription),
  subscriptionController.upgradeSubscription,
);

/* INITIATE PAYMENT */
router.post(
  "/:id/pay",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  subscriptionController.initiatePayment,
);

/* MANUAL PAYMENT CONFIRM (SUPER_ADMIN ONLY) */
router.post(
  "/payments/:id/manual-confirm",
  auth,
  role(["SUPER_ADMIN"]),
  subscriptionController.manualConfirmPayment,
);

/* GET CURRENT SUBSCRIPTION */
router.get(
  "/current",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  tenant,
  subscriptionController.getCurrentSubscription,
);

/* ===========================
   PACKAGE MANAGEMENT (SYSTEM)
   =========================== */

/* LIST PACKAGES */
router.get(
  "/packages",
  auth,
  role(["SUPER_ADMIN", "BUSINESS_OWNER"]),
  subscriptionController.getPackages,
);

/* CREATE PACKAGE */
router.post(
  "/packages",
  auth,
  role(["SUPER_ADMIN"]),
  validate(subscriptionValidation.createPackage),
  subscriptionController.createPackage,
);

/* UPDATE PACKAGE */
router.patch(
  "/packages/:id",
  auth,
  role(["SUPER_ADMIN"]),
  validate(subscriptionValidation.updatePackage),
  subscriptionController.updatePackage,
);

router.post(
  "/payments/:id/reconcile",
  auth,
  role(["SUPER_ADMIN"]),
  tenant,
  subscriptionController.reconcilePayment,
);

router.get(
  "/payments",
  auth,
  role(["SUPER_ADMIN"]),
  tenant,
  subscriptionController.getAllPayments,
);

module.exports = router;
