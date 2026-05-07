const express = require('express');
const controller = require('./setting.controller');
const validate = require('../../../middlewares/validate.middleware');
const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validation = require('./setting.validation');

const PERMISSIONS = require('../../../utils/permission.constants');

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
  '/',
  requirePermission(PERMISSIONS.SETTING_SYSTEM_READ_SYSTEM),
  controller.getSettings,
);

/*
|--------------------------------------------------------------------------
| Get Settings History
|--------------------------------------------------------------------------
*/
router.get(
  '/history',
  requirePermission(PERMISSIONS.SETTING_HISTORY_READ_SYSTEM),
  controller.getSettingsHistory,
);

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
router.patch(
  '/gateways',
  requirePermission(PERMISSIONS.SETTING_GATEWAY_UPDATE_SYSTEM),
  validate(validation.updateGateway),
  controller.updateActiveGateways,
);

/*
|--------------------------------------------------------------------------
| Update Security Config
|--------------------------------------------------------------------------
*/
router.patch(
  '/security',
  requirePermission(PERMISSIONS.SETTING_SECURITY_UPDATE_SYSTEM),
  validate(validation.updateSecurityConfig),
  controller.updateSecurityConfig,
);

module.exports = router;
