const express = require("express");
const controller = require("./setting.controller");
const validate = require("../../../middlewares/validate.middleware");
const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");
const validation = require("./setting.validation");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Apply Auth
|--------------------------------------------------------------------------
*/
router.use(auth);

/*
|--------------------------------------------------------------------------
| Get Settings
|--------------------------------------------------------------------------
*/
router.get(
  "/",
  requirePermission({
    module: "SETTINGS",
    action: "VIEW",
    scope: "SYSTEM",
  }),
  controller.getSettings,
);

/*
|--------------------------------------------------------------------------
| Get Settings History
|--------------------------------------------------------------------------
*/
router.get(
  "/history",
  requirePermission({
    module: "SETTINGS",
    action: "VIEW",
    scope: "SYSTEM",
  }),
  controller.getSettingsHistory,
);

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
router.patch(
  "/gateway",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateGateway),
  controller.updateActiveGateway,
);

/*
|--------------------------------------------------------------------------
| Update Security Config
|--------------------------------------------------------------------------
*/
router.patch(
  "/security",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateSecurityConfig),
  controller.updateSecurityConfig,
);

module.exports = router;
