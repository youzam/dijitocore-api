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
exports.updateActiveGateways = catchAsync(async (req, res) => {
  const { gateways } = req.body;

  // 🔥 basic validation (light — service does heavy validation)
  if (!Array.isArray(gateways) || gateways.length === 0) {
    throw new Error("Invalid gateways payload");
  }

  const data = await settingService.updateActiveGateways(
    gateways,
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
