const express = require("express");

const securityController = require("./security.controller");
const requirePermission = require("../../../middlewares/permission.middleware");

const router = express.Router();

router.post(
  "/incidents",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "SYSTEM" }),
  securityController.createIncident,
);
router.patch(
  "/incidents/:id",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "SYSTEM" }),
  securityController.updateIncident,
);

router.get(
  "/integrity",
  requirePermission({ module: "SECURITY", action: "EXECUTE", scope: "SYSTEM" }),
  securityController.runChecks,
);

router.get("/errors", securityController.getErrors);

module.exports = router;
