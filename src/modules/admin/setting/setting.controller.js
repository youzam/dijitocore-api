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
