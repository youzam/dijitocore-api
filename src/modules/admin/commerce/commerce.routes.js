const express = require("express");
const router = express.Router();

const controller = require("./commerce.controller");
const validation = require("./commerce.validation");

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");
const validate = require("../../../middlewares/validate.middleware");

// 🔐 GLOBAL AUTH
router.use(auth);

/**
 * =========================
 * TRANSACTIONS
 * =========================
 */

router.get(
  "/transactions",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  validate(validation.getTransactions),
  controller.getTransactions,
);

router.get(
  "/transactions/:id",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getTransaction,
);

router.get(
  "/transactions/:id/drilldown",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getTransactionDrilldown,
);

/**
 * =========================
 * FINANCIAL
 * =========================
 */

router.post(
  "/transactions/:id/refund",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  controller.refundTransaction,
);

router.post(
  "/transactions/:id/invoice",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  controller.regenerateInvoice,
);

router.post(
  "/adjustments",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.createAdjustment),
  controller.createAdjustment,
);

/**
 * =========================
 * COUPONS
 * =========================
 */

router.post(
  "/coupons",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.createCoupon),
  controller.createCoupon,
);

router.get(
  "/coupons",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getCoupons,
);

router.patch(
  "/coupons/:id",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.updateCoupon),
  controller.updateCoupon,
);

/**
 * =========================
 * PACKAGES
 * =========================
 */

router.post(
  "/packages",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.createPackage),
  controller.createPackage,
);

router.get(
  "/packages",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getPackages,
);

router.get(
  "/packages/:id",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getPackage,
);

router.patch(
  "/packages/:id",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.updatePackage),
  controller.updatePackage,
);

router.patch(
  "/packages/:id/config",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.updatePackageConfiguration),
  controller.updatePackageConfiguration,
);

router.patch(
  "/packages/:id/deactivate",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  controller.deactivatePackage,
);

/**
 * =========================
 * SUBSCRIPTION CONTROL
 * =========================
 */

router.post(
  "/subscriptions/:id/change-plan",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.changePlan),
  controller.changeSubscriptionPlan,
);

router.post(
  "/subscriptions/:id/cancel",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  controller.cancelSubscription,
);

router.post(
  "/subscriptions/:id/extend",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.extendSubscription),
  controller.extendSubscription,
);

router.get(
  "/subscriptions/:id/grace",
  requirePermission({ module: "COMMERCE", action: "READ" }),
  controller.getGraceStatus,
);

router.post(
  "/subscriptions/:id/grace/extend",
  requirePermission({ module: "COMMERCE", action: "WRITE" }),
  validate(validation.extendGrace),
  controller.extendGracePeriod,
);

module.exports = router;
