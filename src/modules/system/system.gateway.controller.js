const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const gatewayService = require("./system.gateway.service");

exports.getActiveGateway = catchAsync(async (req, res) => {
  const gateway = await gatewayService.getActiveGateway();

  return success(
    req,
    res,
    { activeGateway: gateway },
    200,
    "system.gateway_fetched",
  );
});

exports.updateActiveGateway = catchAsync(async (req, res) => {
  const gateway = await gatewayService.updateActiveGateway({
    gateway: req.body.gateway,
    userId: req.user.id,
  });

  return success(
    req,
    res,
    { activeGateway: gateway },
    200,
    "system.gateway_updated",
  );
});
