const express = require('express');
const router = express.Router();

const controller = require('./commerce.controller');
const validation = require('./commerce.validation');

const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validate = require('../../../middlewares/validate.middleware');

const PERMISSIONS = require('../../../utils/permission.constants');

// 🔐 GLOBAL AUTH
router.use(auth);

/**
 * =========================
 * LEDGER
 * =========================
 */

router.get(
  '/ledger',
  requirePermission(PERMISSIONS.COMMERCE_LEDGER_READ_SYSTEM),
  validate(validation.getLedger),
  controller.getLedger,
);

router.get(
  '/ledger/:id',
  requirePermission(PERMISSIONS.COMMERCE_LEDGERBYID_READ_SYSTEM),
  validate(validation.getLedgerEntry),
  controller.getLedgerEntry,
);

router.get(
  '/ledger/:id/drilldown',
  requirePermission(PERMISSIONS.COMMERCE_LEDGERDRILLDOWN_READ_SYSTEM),
  validate(validation.getLedgerDrilldown),
  controller.getLedgerDrilldown,
);

router.get(
  '/ledger/analytics',
  requirePermission(PERMISSIONS.COMMERCE_LEDGER_READ_SYSTEM),
  validate(validation.getLedgerAnalytics),
  controller.getLedgerAnalytics,
);

router.get(
  '/ledger/balance',
  requirePermission(PERMISSIONS.COMMERCE_LEDGER_READ_SYSTEM),
  controller.getLedgerBalance,
);

/**
 * =========================
 * FINANCIAL
 * =========================
 */

router.post(
  '/transactions/:id/refund',
  requirePermission(PERMISSIONS.COMMERCE_TRANSACTIONREFUND_EXECUTE_SYSTEM),
  controller.refundTransaction,
);

router.post(
  '/transactions/:id/invoice',
  requirePermission(PERMISSIONS.COMMERCE_INVOICEREGENERATE_EXECUTE_SYSTEM),
  controller.regenerateInvoice,
);

router.post(
  '/adjustments',
  requirePermission(PERMISSIONS.COMMERCE_TRANSACTIONADJUSTMENT_EXECUTE_SYSTEM),
  validate(validation.createAdjustment),
  controller.createAdjustment,
);

/**
 * =========================
 * COUPONS
 * =========================
 */

router.post(
  '/coupons',
  requirePermission(PERMISSIONS.COMMERCE_COUPON_CREATE_SYSTEM),
  validate(validation.createCoupon),
  controller.createCoupon,
);

router.get(
  '/coupons',
  requirePermission(PERMISSIONS.COMMERCE_COUPON_READ_SYSTEM),
  controller.getCoupons,
);

router.patch(
  '/coupons/:id',
  requirePermission(PERMISSIONS.COMMERCE_COUPON_UPDATE_SYSTEM),
  validate(validation.updateCoupon),
  controller.updateCoupon,
);

/**
 * =========================
 * PACKAGES
 * =========================
 */

router.post(
  '/packages',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGE_CREATE_SYSTEM),
  validate(validation.createPackage),
  controller.createPackage,
);

router.get(
  '/packages',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGE_READ_SYSTEM),
  controller.getPackages,
);

router.get(
  '/packages/:id',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGEBYID_READ_SYSTEM),
  controller.getPackage,
);

router.patch(
  '/packages/:id',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGE_UPDATE_SYSTEM),
  validate(validation.updatePackage),
  controller.updatePackage,
);

router.patch(
  '/packages/:id/config',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGECONFIGURATION_UPDATE_SYSTEM),
  validate(validation.updatePackageConfiguration),
  controller.updatePackageConfiguration,
);

router.patch(
  '/packages/:id/deactivate',
  requirePermission(PERMISSIONS.COMMERCE_PACKAGEDEACTIVATE_EXECUTE_SYSTEM),
  controller.deactivatePackage,
);

/**
 * =========================
 * SUBSCRIPTION CONTROL
 * =========================
 */

router.post(
  '/subscriptions/:id/change-plan',
  requirePermission(PERMISSIONS.COMMERCE_SUBSCRIPTIONPLANCHANGE_EXECUTE_SYSTEM),
  validate(validation.changePlan),
  controller.changeSubscriptionPlan,
);

router.post(
  '/subscriptions/:id/cancel',
  requirePermission(PERMISSIONS.COMMERCE_SUBSCRIPTIONCANCEL_EXECUTE_SYSTEM),
  controller.cancelSubscription,
);

router.post(
  '/subscriptions/:id/extend',
  requirePermission(PERMISSIONS.COMMERCE_SUBSCRIPTIONEXTEND_EXECUTE_SYSTEM),
  validate(validation.extendSubscription),
  controller.extendSubscription,
);

router.get(
  '/subscriptions/:id/grace',
  requirePermission(PERMISSIONS.COMMERCE_SUBSCRIPTIONGRACE_READ_SYSTEM),
  controller.getGraceStatus,
);

router.post(
  '/subscriptions/:id/grace/extend',
  requirePermission(
    PERMISSIONS.COMMERCE_SUBSCRIPTIONGRACEEXTEND_EXECUTE_SYSTEM,
  ),
  validate(validation.extendGrace),
  controller.extendGracePeriod,
);

module.exports = router;
