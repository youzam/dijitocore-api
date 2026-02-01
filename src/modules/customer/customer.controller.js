const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const service = require("./customer.service");

exports.createCustomer = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;

  const customer = await service.createCustomer(businessId, req.body, req);

  return response.success(req, res, customer, 201, "customer.created");
});

exports.listCustomers = catchAsync(async (req, res) => {
  const result = await service.listCustomers(req.user.businessId, req.query);

  return response.success(req, res, result);
});

exports.getCustomer = catchAsync(async (req, res) => {
  const customer = await service.getCustomer(
    req.user.businessId,
    req.params.id,
  );

  return response.success(req, res, customer);
});

exports.updateCustomer = catchAsync(async (req, res) => {
  const customer = await service.updateCustomer(
    req.user.businessId,
    req.params.id,
    req.body,
  );

  return response.success(req, res, customer, 200, "customer.updated");
});

exports.updateStatus = catchAsync(async (req, res) => {
  const customer = await service.updateStatus(
    req.user.businessId,
    req.params.id,
    req.body.status,
  );

  return response.success(req, res, customer, 200, "customer.status_updated");
});

exports.updateBlacklist = catchAsync(async (req, res) => {
  const customer = await service.updateBlacklist(
    req.user.businessId,
    req.params.id,
    req.body.isBlacklisted,
  );

  return response.success(
    req,
    res,
    customer,
    200,
    req.body.isBlacklisted ? "customer.blacklisted" : "customer.unblacklisted",
  );
});

exports.importCustomers = catchAsync(async (req, res) => {
  const result = await service.importCustomers(req.user.businessId, req);

  return response.success(req, res, result, 200, "customer.imported");
});
