const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

const commerceService = require("./commerce.service");

exports.manualConfirmPayment = catchAsync(async (req, res) => {
  const data = await commerceService.manualConfirmPayment(req.params.id);
  return response.success(req, res, data);
});

exports.reconcilePayment = catchAsync(async (req, res) => {
  const data = await commerceService.reconcilePayment(req.params.id);
  return response.success(req, res, data);
});

exports.getAllPayments = catchAsync(async (req, res) => {
  const data = await commerceService.getAllPayments(req.query);
  return response.success(req, res, data);
});

exports.createPackage = catchAsync(async (req, res) => {
  const data = await commerceService.createPackage(req.body);
  return response.success(req, res, data);
});

exports.updatePackage = catchAsync(async (req, res) => {
  const data = await commerceService.updatePackage(req.params.id, req.body);
  return response.success(req, res, data);
});

exports.updatePackageConfiguration = catchAsync(async (req, res) => {
  const data = await commerceService.updatePackageConfiguration(
    req.params.id,
    req.body,
  );

  return response.success(req, res, data);
});
