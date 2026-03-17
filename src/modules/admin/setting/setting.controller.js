const settingService = require("./setting.service");
const catchAsync = require("../../../utils/catchAsync");
const { success } = require("../../../utils/response");

/*
|--------------------------------------------------------------------------
| Get All Settings
|--------------------------------------------------------------------------
*/
exports.getSettings = catchAsync(async (req, res) => {
  const data = await settingService.getSettings();

  return success(req, res, data, 200, "settings.fetched");
});

/*
|--------------------------------------------------------------------------
| Get Settings History
|--------------------------------------------------------------------------
*/
exports.getSettingsHistory = catchAsync(async (req, res) => {
  const data = await settingService.getSettingsHistory();

  return success(req, res, data, 200, "settings.history_fetched");
});

/*
|--------------------------------------------------------------------------
| Update Currency
|--------------------------------------------------------------------------
*/
exports.updateCurrency = catchAsync(async (req, res) => {
  const data = await settingService.updateCurrency(
    req.body.currency,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update Payment Gateway
|--------------------------------------------------------------------------
*/
exports.updateActiveGateway = catchAsync(async (req, res) => {
  const data = await settingService.updateActiveGateway(
    req.body.gateway,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update Security Config
|--------------------------------------------------------------------------
*/
exports.updateSecurityConfig = catchAsync(async (req, res) => {
  const data = await settingService.updateSecurityConfig(
    req.body,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update API Config
|--------------------------------------------------------------------------
*/
exports.updateApiConfig = catchAsync(async (req, res) => {
  const data = await settingService.updateApiConfig(req.body, req.admin.id);

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update Notification Config
|--------------------------------------------------------------------------
*/
exports.updateNotificationConfig = catchAsync(async (req, res) => {
  const data = await settingService.updateNotificationConfig(
    req.body,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update Branding Config
|--------------------------------------------------------------------------
*/
exports.updateBrandingConfig = catchAsync(async (req, res) => {
  const data = await settingService.updateBrandingConfig(
    req.body,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});

/*
|--------------------------------------------------------------------------
| Update Maintenance Config
|--------------------------------------------------------------------------
*/
exports.updateMaintenanceConfig = catchAsync(async (req, res) => {
  const data = await settingService.updateMaintenanceConfig(
    req.body,
    req.admin.id,
  );

  return success(req, res, data, 200, "settings.updated");
});
