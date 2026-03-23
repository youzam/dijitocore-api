const express = require("express");
const router = express.Router();

const auditController = require("./audit.controller");

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");

router.use(auth);

/*
|--------------------------------------------------------------------------
| Tenant Audit Routes (BUSINESS OWNER ONLY)
|--------------------------------------------------------------------------
*/

router.get(
  "/audit-logs",
  tenant,
  role(["BUSINESS_OWNER"]),
  auditController.getTenantAuditLogs,
);

router.get(
  "/audit-logs/:id",
  tenant,
  role(["BUSINESS_OWNER"]),
  auditController.getTenantAuditLogById,
);

module.exports = router;
