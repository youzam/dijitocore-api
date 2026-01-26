const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const service = require("./business.service");

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
 * BUSINESS LIFECYCLE (SYSTEM)
 * =========================
 */
exports.activateBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "ACTIVE",
  );
  return response.success(req, res, data, "business.activated");
});

exports.moveToGrace = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "GRACE",
  );
  return response.success(req, res, data, "business.grace");
});

exports.suspendBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "SUSPENDED",
  );
  return response.success(req, res, data, "business.suspended");
});

exports.terminateBusiness = catchAsync(async (req, res) => {
  const data = await service.updateBusinessStatus(
    req.params.businessId,
    "TERMINATED",
  );
  return response.success(req, res, data, "business.terminated");
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
 * BUSINESS USERS — INVITE FLOW
 * =========================
 */
exports.inviteBusinessUser = catchAsync(async (req, res) => {
  const data = await service.inviteBusinessUser(req.user, req.body);
  return response.success(req, res, data);
});

exports.listInvites = catchAsync(async (req, res) => {
  const data = await service.listInvites(req.user.businessId);
  return response.success(req, res, data);
});

exports.revokeInvite = catchAsync(async (req, res) => {
  const data = await service.revokeInvite(
    req.user.businessId,
    req.params.inviteId,
  );
  return response.success(req, res, data);
});

/**
 * =========================
 * ACTIVE BUSINESS USERS
 * =========================
 */
exports.listBusinessUsers = catchAsync(async (req, res) => {
  const data = await service.listBusinessUsers(req.user.businessId);
  return response.success(req, res, data);
});

exports.updateBusinessUser = catchAsync(async (req, res) => {
  const data = await service.updateBusinessUser(
    req.user,
    req.params.userId,
    req.body,
  );
  return response.success(req, res, data);
});

exports.deactivateBusinessUser = catchAsync(async (req, res) => {
  const data = await service.deactivateBusinessUser(
    req.user,
    req.params.userId,
  );
  return response.success(req, res, data);
});

exports.activateBusinessUser = catchAsync(async (req, res) => {
  const data = await service.activateBusinessUser(req.user, req.params.userId);
  return response.success(req, res, data);
});
