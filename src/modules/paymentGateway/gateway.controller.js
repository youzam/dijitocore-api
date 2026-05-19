const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/response');
const paymentGatewayService = require('./gateway.service');

/*
|--------------------------------------------------------------------------
| Get Active Payment Gateways (Client Facing)
|--------------------------------------------------------------------------
*/
exports.getActivePaymentGateways = catchAsync(async (req, res) => {
  const data = await paymentGatewayService.getActivePaymentGateways();

  return success(req, res, data, 200);
});
