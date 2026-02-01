const authService = require("./auth.service.js");
const catchAsync = require("../../utils/catchAsync.js");
const response = require("../../utils/response");

/**
 * =====================================================
 * BUSINESS OWNER SIGNUP
 * =====================================================
 */
const ownerSignup = catchAsync(async (req, res) => {
  const result = await authService.ownerSignup(req.body);
  return response.success(req, res, result, 201);
});

/**
 * =====================================================
 * VERIFY EMAIL ADDRESS
 * =====================================================
 */
const verifyEmail = catchAsync(async (req, res) => {
  const result = await authService.verifyEmail(req.body.code);
  return response.success(req, res, result);
});

/**
 * =====================================================
 * LOGIN / REFRESH / LOGOUT
 * =====================================================
 */
const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  return response.success(req, res, result);
});

const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.body.refresh_token);
  return response.success(req, res, result);
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.auth);
  res.status(204).send();
});

/**
 * =====================================================
 * ACCEPT BUSINESS INVITE
 * =====================================================
 */
const acceptInvite = catchAsync(async (req, res) => {
  const token = req.body.token || req.params.token || req.query.token;
  const data = await authService.acceptInvite({ ...req.body, token });
  return response.success(req, res, data);
});

/**
 * =====================================================
 * PASSWORD RESET
 * =====================================================
 */
const requestPasswordReset = catchAsync(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  return response.success(req, res, {});
});

const resetPassword = catchAsync(async (req, res) => {
  const result = await authService.resetPassword(
    req.body.token,
    req.body.password,
  );

  return response.success(req, res, result);
});

/**
 * =====================================================
 * CUSTOMER AUTH – IDENTIFY + OTP
 * =====================================================
 */
const customerIdentify = catchAsync(async (req, res) => {
  const result = await authService.customerIdentify(req.body.phone);
  return response.success(req, res, result);
});

const customerRequestOtp = catchAsync(async (req, res) => {
  await authService.customerRequestOtp(req.body.phone, req.body.businessId);
  res.status(200).json({});
});

const customerVerifyOtp = catchAsync(async (req, res) => {
  const result = await authService.customerVerifyOtp(
    req.body.phone,
    req.body.businessId,
    req.body.otp,
  );
  return response.success(req, res, result);
});

/**
 * =====================================================
 * SYSTEM LOGIN (SUPER ADMIN)
 * =====================================================
 */
const systemLogin = catchAsync(async (req, res) => {
  const data = await authService.systemLogin(req.body);
  return response.success(req, res, data);
});

module.exports = {
  ownerSignup,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  customerIdentify,
  customerRequestOtp,
  customerVerifyOtp,
  verifyEmail,
  acceptInvite,
  systemLogin,
};
