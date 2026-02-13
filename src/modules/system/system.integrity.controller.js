const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const integrityService = require("./system.integrity.service");

exports.runChecks = catchAsync(async (req, res) => {
  const result = await integrityService.runIntegrityChecks();

  return success(req, res, result, 200, "system.integrityChecked");
});
