const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const healthService = require("./system.health.service");

exports.getHealth = catchAsync(async (req, res) => {
  const health = await healthService.getSystemHealth();

  return success(req, res, health, 200, "system.healthFetched");
});
