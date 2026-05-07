const express = require('express');
const router = express.Router();

const reportingController = require('./reporting.controller');
const validate = require('../../../middlewares/validate.middleware');
const reportingValidation = require('./reporting.validation');

const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');

const PERMISSIONS = require('../../../utils/permission.constants');

// =============================
// GLOBAL AUTH
// =============================
router.use(auth);

// =============================
// REPORT ROUTES
// =============================

// TRANSACTIONS
router.get(
  '/transactions',
  requirePermission(PERMISSIONS.REPORTING_TRANSACTION_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getTransactionReport,
);

// MONTHLY REVENUE
router.get(
  '/revenue/monthly',
  requirePermission(PERMISSIONS.REPORTING_REVENUE_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getMonthlyRevenueReport,
);

// SETUP FEES
router.get(
  '/setup-fees',
  requirePermission(PERMISSIONS.REPORTING_SETUPFEE_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getSetupFeeReport,
);

// SUBSCRIPTION REVENUE
router.get(
  '/subscription-revenue',
  requirePermission(PERMISSIONS.REPORTING_SUBSCRIPTION_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getSubscriptionRevenueReport,
);

// REFUNDS
router.get(
  '/refunds',
  requirePermission(PERMISSIONS.REPORTING_REFUND_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getRefundReport,
);

// COUPONS
router.get(
  '/coupons',
  requirePermission(PERMISSIONS.REPORTING_COUPON_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getCouponReport,
);

// SUPPORT
router.get(
  '/support',
  requirePermission(PERMISSIONS.REPORTING_SUPPORT_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getSupportReport,
);

// AUDIT
router.get(
  '/audit',
  requirePermission(PERMISSIONS.REPORTING_AUDIT_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getAuditReport,
);

// COMPLIANCE
router.get(
  '/compliance',
  requirePermission(PERMISSIONS.REPORTING_COMPLIANCE_READ_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.getComplianceReport,
);

// =============================
// ASYNC EXPORT
// =============================
router.get(
  '/export/:type',
  requirePermission(PERMISSIONS.REPORTING_EXPORT_EXECUTE_SYSTEM),
  validate(reportingValidation.getReport),
  reportingController.createAsyncExport,
);

// EXPORT HISTORY
router.get(
  '/export/history',
  requirePermission(PERMISSIONS.REPORTING_EXPORT_READ_SYSTEM),
  reportingController.getExportHistory,
);

// DOWNLOAD EXPORT
router.get(
  '/export/download/:id',
  requirePermission(PERMISSIONS.REPORTING_EXPORTDOWNLOAD_EXECUTE_SYSTEM),
  reportingController.downloadExport,
);

// =============================
// SUPPORT ANALYTICS (EXTRA)
// =============================

router.get(
  '/support/summary',
  requirePermission(PERMISSIONS.REPORTING_SUPPORT_READ_SYSTEM),
  reportingController.getSupportSummary,
);

router.get(
  '/support/sla',
  requirePermission(PERMISSIONS.REPORTING_SUPPORT_READ_SYSTEM),
  reportingController.getSupportSLA,
);

router.get(
  '/support/business',
  requirePermission(PERMISSIONS.REPORTING_SUPPORT_READ_SYSTEM),
  reportingController.getTicketsPerBusiness,
);

module.exports = router;
