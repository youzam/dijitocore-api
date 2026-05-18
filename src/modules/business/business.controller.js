const catchAsync = require('../../utils/catchAsync');
const response = require('../../utils/response');
const service = require('./business.service');

/**
 * =========================
 * CREATE BUSINESS (OWNER)
 * Includes guided setup (settings)
 * =========================
 */
exports.createBusiness = catchAsync(async (req, res) => {
  const result = await service.createBusiness(req.user, req.body);
  return response.success(req, res, result);
});

/**
 * =========================
 * BUSINESS SETTINGS (OWNER)
 * =========================
 */
exports.getBusinessSettings = catchAsync(async (req, res) => {
  const data = await service.getBusinessSettings(req.user.businessId);
  return response.success(req, res, data);
});

exports.updateBusinessSettings = catchAsync(async (req, res) => {
  const data = await service.updateBusinessSettings(req.user, req.body);
  return response.success(req, res, data);
});

/**
 * =========================
 * VIEW BUSINESS DETAILS
 * =========================
 */
exports.getBusinessDetails = catchAsync(async (req, res) => {
  const data = await service.getBusinessDetails(req.params.businessId);
  return response.success(req, res, data);
});

/**
 * =========================
 * GET MY BUSINESS
 * =========================
 */
exports.getMyBusiness = catchAsync(async (req, res) => {
  const data = await service.getMyBusiness(req.user);

  return response.success(req, res, data);
});
