const express = require("express");

const analyticsController = require("./analytics.controller");
const analyticsValidation = require("./analytics.validation");

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/requirePermission.middleware");
const validate = require("../../../middlewares/validate.middleware");

const router = express.Router();

// =============================
// GLOBAL MIDDLEWARES
// =============================
router.use(auth);

router.use(
  requirePermission({
    module: "analytics",
    action: "read",
    scope: "global",
  }),
);

// =============================
// DASHBOARD
// =============================
router.get(
  "/dashboard",
  validate(analyticsValidation.query),
  analyticsController.getDashboard,
);

// =============================
// REVENUE
// =============================
router.get(
  "/revenue/trends",
  validate(analyticsValidation.query),
  analyticsController.getRevenueTrends,
);

router.get(
  "/revenue/country",
  validate(analyticsValidation.query),
  analyticsController.getRevenueByCountry,
);

router.get(
  "/revenue/package",
  validate(analyticsValidation.query),
  analyticsController.getRevenueByPackage,
);

// =============================
// SUBSCRIPTIONS
// =============================
router.get("/subscriptions", analyticsController.getSubscriptionMetrics);

// =============================
// GROWTH
// =============================
router.get(
  "/growth/business",
  validate(analyticsValidation.query),
  analyticsController.getBusinessGrowth,
);

router.get(
  "/growth/users",
  validate(analyticsValidation.query),
  analyticsController.getUserGrowth,
);

// =============================
// COHORT
// =============================
router.get("/cohort", analyticsController.getCohortAnalysis);

// =============================
// TENANT HEALTH
// =============================
router.get("/tenant-health", analyticsController.getTenantHealth);

// =============================
// ADVANCED ANALYTICS
// =============================

router.get(
  "/cohort",
  validate(analyticsValidation.query),
  analyticsController.getCohortAnalysis,
);

router.get(
  "/tenant-health",
  validate(analyticsValidation.query),
  analyticsController.getTenantHealth,
);

router.get(
  "/cohort-retention",
  validate(analyticsValidation.query),
  analyticsController.getCohortRetention,
);

router.get(
  "/usage",
  validate(analyticsValidation.query),
  analyticsController.getUsageAnalytics,
);

router.get(
  "/expansion-revenue",
  validate(analyticsValidation.query),
  analyticsController.getExpansionRevenue,
);

router.get(
  "/renewal-rate",
  validate(analyticsValidation.query),
  analyticsController.getRenewalRate,
);

router.get(
  "/conversion-rate",
  validate(analyticsValidation.query),
  analyticsController.getConversionRate,
);

router.get(
  "/tenant-health-advanced",
  validate(analyticsValidation.query),
  analyticsController.getTenantHealthAdvanced,
);
module.exports = router;
