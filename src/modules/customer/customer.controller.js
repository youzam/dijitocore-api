const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const customerService = require("./customer.service");

exports.createCustomer = catchAsync(async (req, res) => {
  const businessId = req.user.businessId;

  const customer = await customerService.createCustomer(businessId, req.body);

  return response.success(req, res, customer);
});
