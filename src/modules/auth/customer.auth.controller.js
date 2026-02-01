const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const customerAuthService = require("./customer.auth.service");
const { translate } = require("../../utils/i18n");

/**
 * Request OTP
 */
exports.requestOtp = catchAsync(async (req, res) => {
  const { phone, businessCode } = req.body;

  await customerAuthService.requestOtp(phone, businessCode);

  return response.success(req, res, {
    message: translate("auth.otp_sent", req.locale),
  });
});

/**
 * Verify OTP
 */
exports.verifyOtp = catchAsync(async (req, res) => {
  const { phone, businessCode, otp } = req.body;

  const customer = await customerAuthService.verifyOtp(
    phone,
    businessCode,
    otp,
  );

  return response.success(req, res, {
    customerId: customer.id,
  });
});

/**
 * Set PIN
 */
exports.setPin = catchAsync(async (req, res) => {
  const { customerId, pin } = req.body;

  await customerAuthService.setPin(customerId, pin);

  return response.success(req, res, {
    message: translate("auth.pin_set_success", req.locale),
  });
});

/**
 * Login with PIN
 */
exports.loginWithPin = catchAsync(async (req, res) => {
  const { phone, businessCode, pin } = req.body;

  const result = await customerAuthService.loginWithPin(
    phone,
    businessCode,
    pin,
  );

  return response.success(req, res, result);
});
