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

module.exports = router;
