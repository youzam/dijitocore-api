const authService = require('./auth.service.js');
const customerAuthService = require('./customer.auth.service');
const catchAsync = require('../../utils/catchAsync.js');
const response = require('../../utils/response');
const { translate } = require('../../utils/i18n.js');

exports.ownerSignup = catchAsync(async (req, res) => {
  const result = await authService.ownerSignup(req.body, req);
  return response.success(req, res, result, 201);
});

exports.verifyEmail = catchAsync(async (req, res) => {
  const result = await authService.verifyEmail(req.body.code);
  return response.success(req, res, result);
});

exports.resendEmailCode = catchAsync(async (req, res) => {
  await authService.resendEmailCode(req.body.email);

  return response.success(req, res, {});
});

exports.login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, req);
  return response.success(req, res, result);
});

exports.refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.body.refresh_token);
  return response.success(req, res, result);
});

exports.logout = catchAsync(async (req, res) => {
  await authService.logout(req.auth, req.body.refresh_token);
  return res.status(204).send();
});

exports.requestPasswordReset = catchAsync(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  return response.success(req, res, {});
});

exports.resetPassword = catchAsync(async (req, res) => {
  const result = await authService.resetPassword(
    req.body.token,
    req.body.password,
  );

  return response.success(req, res, result);
});

exports.requestOtp = catchAsync(async (req, res) => {
  const { phone, businessCode } = req.body;

  await customerAuthService.requestOtp(phone, businessCode);

  return response.success(req, res, {
    message: translate('auth.otp_sent', req.locale),
  });
});

exports.verifyOtp = catchAsync(async (req, res) => {
  const { phone, businessCode, otp } = req.body;

  const result = await customerAuthService.verifyOtp(
    phone,
    businessCode,
    otp,
    req,
  );

  return response.success(req, res, result);
});

exports.setPin = catchAsync(async (req, res) => {
  await customerAuthService.setPin(req.auth.id, req.body.pin, req);

  return response.success(req, res, {
    message: translate('auth.pin_set_success', req.locale),
  });
});

exports.loginWithPin = catchAsync(async (req, res) => {
  const { phone, businessCode, pin } = req.body;

  const result = await customerAuthService.loginWithPin(
    phone,
    businessCode,
    pin,
    req,
  );

  return response.success(req, res, result);
});
