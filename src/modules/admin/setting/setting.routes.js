const express = require("express");

const settingController = require("./setting.controller");
const settingValidation = require("./setting.validation");
const validate = require("../../../middlewares/validate.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");

const router = express.Router();

/* GET ACTIVE GATEWAY */
router.get(
  "/gateway",
  requirePermission({ module: "SETTINGS", action: "VIEW", scope: "SYSTEM" }),
  settingController.getActiveGateway,
);

/* UPDATE ACTIVE GATEWAY */
router.patch(
  "/gateway",
  validate(settingValidation.updateGateway),
  requirePermission({ module: "SETTINGS", action: "EDIT", scope: "SYSTEM" }),
  settingController.updateActiveGateway,
);

module.exports = router;
