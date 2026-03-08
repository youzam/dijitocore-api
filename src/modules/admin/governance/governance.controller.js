const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");
const service = require("./governance.service");

exports.activateBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "ACTIVE",
  );
  return response.success(req, res, data, 200, "business.activated");
});

exports.moveToGrace = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "GRACE",
  );
  return response.success(req, res, data, 200, "business.grace");
});

exports.suspendBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "SUSPENDED",
  );
  return response.success(req, res, data, 200, "business.suspended");
});

exports.terminateBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "TERMINATED",
  );
  return response.success(req, res, data, 200, "business.terminated");
});
