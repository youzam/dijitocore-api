const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const service = require("./user.service");

// INVITE
exports.inviteUser = catchAsync(async (req, res) => {
  const result = await service.inviteUser(req.user, req.body);
  return response.success(req, res, result, 201);
});

// ACCEPT
exports.acceptInvite = catchAsync(async (req, res) => {
  const result = await service.acceptInvite(req.body);
  return response.success(req, res, result);
});

// INVITES
exports.listInvites = catchAsync(async (req, res) => {
  const result = await service.listInvites(req.user);
  return response.success(req, res, result);
});

exports.revokeInvite = catchAsync(async (req, res) => {
  const result = await service.revokeInvite(req.user, req.params.id);
  return response.success(req, res, result);
});

// USERS
exports.listUsers = catchAsync(async (req, res) => {
  const result = await service.listUsers(req.user);
  return response.success(req, res, result);
});

exports.updateUser = catchAsync(async (req, res) => {
  const result = await service.updateUser(req.user, req.params.id, req.body);
  return response.success(req, res, result);
});

exports.activateUser = catchAsync(async (req, res) => {
  const result = await service.activateUser(req.user, req.params.id);
  return response.success(req, res, result);
});

exports.deactivateUser = catchAsync(async (req, res) => {
  const result = await service.deactivateUser(req.user, req.params.id);
  return response.success(req, res, result);
});
