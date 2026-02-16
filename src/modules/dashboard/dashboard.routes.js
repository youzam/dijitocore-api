const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const role = require("../../middlewares/role.middleware");
const tenant = require("../../middlewares/tenant.middleware");

const controller = require("./dashboard.controller");

router.use(auth);
router.use(tenant);
/**
 * ===============================
 * ENTERPRISE DASHBOARD
 * ===============================
 *
 * BUSINESS_OWNER + MANAGER + STAFF
 */
router.get(
  "/",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getEnterpriseDashboard,
);

router.get(
  "/insights",
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getInsights,
);

router.get(
  "/export/csv",
  role("BUSINESS_OWNER", "MANAGER"),
  controller.exportCSV,
);

router.get(
  "/export/pdf",
  role("BUSINESS_OWNER", "MANAGER"),
  controller.exportPDF,
);

/**
 * ===============================
 * ANALYTICS ROUTES (ADDED BELOW)
 * ===============================
 */

router.get(
  "/analytics/snapshots",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getSnapshotSeries,
);

router.get(
  "/analytics/health-timeline",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getHealthTimeline,
);

router.get(
  "/analytics/insights",
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getAnalyticsInsights,
);

router.get(
  "/analytics/cohorts",
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getCohorts,
);

router.get(
  "/analytics/projections",
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getProjections,
);

router.get(
  "/analytics/audit",
  role(["BUSINESS_OWNER"]),
  controller.getAuditDashboard,
);

router.get(
  "/enterprise/role",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getRoleDashboard,
);

module.exports = router;
