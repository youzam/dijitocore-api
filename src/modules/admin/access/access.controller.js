const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

const accessService = require("./access.service");

exports.adminLogin = catchAsync(async (req, res) => {
  const result = await accessService.adminLogin(req.body);

  return response.success(req, res, result);
});
