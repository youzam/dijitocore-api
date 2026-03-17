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
| Update Currency
|--------------------------------------------------------------------------
*/
router.patch(
  "/currency",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateCurrency),
  controller.updateCurrency,
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

/*
|--------------------------------------------------------------------------
| Update API Config
|--------------------------------------------------------------------------
*/
router.patch(
  "/api",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateApiConfig),
  controller.updateApiConfig,
);

/*
|--------------------------------------------------------------------------
| Update Notification Config
|--------------------------------------------------------------------------
*/
router.patch(
  "/notification",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateNotificationConfig),
  controller.updateNotificationConfig,
);

/*
|--------------------------------------------------------------------------
| Update Branding Config
|--------------------------------------------------------------------------
*/
router.patch(
  "/branding",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateBrandingConfig),
  controller.updateBrandingConfig,
);

/*
|--------------------------------------------------------------------------
| Update Maintenance Config
|--------------------------------------------------------------------------
*/
router.patch(
  "/maintenance",
  requirePermission({
    module: "SETTINGS",
    action: "EDIT",
    scope: "SYSTEM",
  }),
  validate(validation.updateMaintenanceConfig),
  controller.updateMaintenanceConfig,
);

module.exports = router;
