const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const role = require("../../middlewares/role.middleware");

const controller = require("./dashboard.controller");

/**
 * ===============================
 * ENTERPRISE DASHBOARD
 * ===============================
 *
 * BUSINESS_OWNER + MANAGER + STAFF
 */
router.get(
  "/",
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getEnterpriseDashboard,
);

router.get(
  "/insights",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getInsights,
);

router.get(
  "/export/csv",
  auth,
  role("BUSINESS_OWNER", "MANAGER"),
  controller.exportCSV,
);

router.get(
  "/export/pdf",
  auth,
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
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getSnapshotSeries,
);

router.get(
  "/analytics/health-timeline",
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getHealthTimeline,
);

router.get(
  "/analytics/insights",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getAnalyticsInsights,
);

router.get(
  "/analytics/cohorts",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getCohorts,
);

router.get(
  "/analytics/projections",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.getProjections,
);

router.get(
  "/analytics/audit",
  auth,
  role(["BUSINESS_OWNER"]),
  controller.getAuditDashboard,
);

router.get(
  "/enterprise/role",
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getRoleDashboard,
);

module.exports = router;
