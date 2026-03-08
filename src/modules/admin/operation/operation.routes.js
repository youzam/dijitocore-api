const express = require("express");

const operationController = require("./operation.controller");
const requirePermission = require("../../../middlewares/permission.middleware");
const authMiddleware = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/health",
  requirePermission({ module: "OPERATIONS", action: "VIEW", scope: "SYSTEM" }),
  operationController.getHealth,
);

router.get("/jobs", operationController.getJobs);
router.post(
  "/admin/jobs/:jobName/trigger",
  authMiddleware,
  requirePermission({
    module: "OPERATIONS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  operationController.triggerJob,
);

module.exports = router;
