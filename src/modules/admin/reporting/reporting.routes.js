const express = require("express");
const router = express.Router();

const reportingController = require("./reporting.controller");
const validate = require("../../../middlewares/validate.middleware");
const reportingValidation = require("./reporting.validation");

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/requirePermission.middleware");

// =============================
// GLOBAL AUTH
// =============================
router.use(auth);

// =============================
// REPORT ROUTES
// =============================

// TRANSACTIONS
router.get(
  "/transactions",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "TRANSACTIONS",
  }),
  validate(reportingValidation.getReport),
  reportingController.getTransactionReport,
);

// MONTHLY REVENUE
router.get(
  "/revenue/monthly",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "REVENUE",
  }),
  validate(reportingValidation.getReport),
  reportingController.getMonthlyRevenueReport,
);

// SETUP FEES
router.get(
  "/setup-fees",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "SETUP_FEES",
  }),
  validate(reportingValidation.getReport),
  reportingController.getSetupFeeReport,
);

// SUBSCRIPTION REVENUE
router.get(
  "/subscription-revenue",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "SUBSCRIPTION",
  }),
  validate(reportingValidation.getReport),
  reportingController.getSubscriptionRevenueReport,
);

// REFUNDS
router.get(
  "/refunds",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "REFUNDS",
  }),
  validate(reportingValidation.getReport),
  reportingController.getRefundReport,
);

// COUPONS
router.get(
  "/coupons",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "COUPONS",
  }),
  validate(reportingValidation.getReport),
  reportingController.getCouponReport,
);

// SUPPORT
router.get(
  "/support",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "SUPPORT",
  }),
  validate(reportingValidation.getReport),
  reportingController.getSupportReport,
);

// AUDIT
router.get(
  "/audit",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "AUDIT",
  }),
  validate(reportingValidation.getReport),
  reportingController.getAuditReport,
);

// COMPLIANCE
router.get(
  "/compliance",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "COMPLIANCE",
  }),
  validate(reportingValidation.getReport),
  reportingController.getComplianceReport,
);

// =============================
// ASYNC EXPORT
// =============================
router.get(
  "/export/:type",
  requirePermission({
    module: "reporting",
    action: "export",
    scope: "TRANSACTIONS", // unaweza kubadilisha kulingana na logic yako
  }),
  validate(reportingValidation.getReport),
  reportingController.createAsyncExport,
);

// EXPORT HISTORY
router.get(
  "/export/history",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "TRANSACTIONS",
  }),
  reportingController.getExportHistory,
);

// DOWNLOAD EXPORT
router.get(
  "/export/download/:id",
  requirePermission({
    module: "reporting",
    action: "read",
    scope: "TRANSACTIONS",
  }),
  reportingController.downloadExport,
);
router.get(
  "/support/summary",
  requirePermission({ module: "REPORTING", action: "READ" }),
  controller.getSupportSummary,
);

router.get(
  "/support/sla",
  requirePermission({ module: "REPORTING", action: "READ" }),
  controller.getSupportSLA,
);

router.get(
  "/support/business",
  requirePermission({ module: "REPORTING", action: "READ" }),
  controller.getTicketsPerBusiness,
);

module.exports = router;
