const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

const accessService = require("./access.service");

/*
|--------------------------------------------------------------------------
| SYSTEM BOOTSTRAP
|--------------------------------------------------------------------------
*/

exports.bootstrapSystem = catchAsync(async (req, res) => {
  const data = await accessService.bootstrapSystemService(req.body);

  return response.success(req, res, data, 201, "access.system_bootstrapped");
});

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/
exports.setupAdminMFA = catchAsync(async (req, res) => {
  const data = await accessService.setupAdminMFA(req.user.id);

  return response.success(req, res, data, 200, "access.mfa_setup");
});

exports.verifyAdminMFASetup = catchAsync(async (req, res) => {
  const data = await accessService.verifyAdminMFASetup(
    req.user.id,
    req.body.token,
  );

  return response.success(req, res, data, 200, "access.mfa_enabled");
});

exports.disableAdminMFA = catchAsync(async (req, res) => {
  const data = await accessService.disableAdminMFA(req.user.id, req.body.token);

  return response.success(req, res, data, 200, "access.mfa_disabled");
});

exports.adminLogin = catchAsync(async (req, res) => {
  const data = await accessService.adminLogin(req.body);

  return response.success(req, res, data, 200, "access.login_success");
});

exports.logoutAdmin = catchAsync(async (req, res) => {
  const data = await accessService.logoutAdmin(req.user.id);

  return response.success(req, res, data, 200, "access.logout_success");
});

/*
|--------------------------------------------------------------------------
| ADMIN MANAGEMENT
|--------------------------------------------------------------------------
*/

exports.createAdmin = catchAsync(async (req, res) => {
  const data = await accessService.createAdmin(req.body);

  return response.success(req, res, data, 201, "access.admin_created");
});

exports.listAdmins = catchAsync(async (req, res) => {
  const data = await accessService.listAdmins(req.query);

  return response.success(req, res, data);
});

exports.getAdmin = catchAsync(async (req, res) => {
  const data = await accessService.getAdmin(req.params.id);

  return response.success(req, res, data);
});

exports.updateAdmin = catchAsync(async (req, res) => {
  const data = await accessService.updateAdmin(req.params.id, req.body);

  return response.success(req, res, data, 200, "access.admin_updated");
});

exports.suspendAdmin = catchAsync(async (req, res) => {
  const data = await accessService.suspendAdmin(req.params.id);

  return response.success(req, res, data, 200, "access.admin_suspended");
});

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT
|--------------------------------------------------------------------------
*/

exports.listRoles = catchAsync(async (req, res) => {
  const data = await accessService.listRoles();

  return response.success(req, res, data);
});

exports.changeAdminRole = catchAsync(async (req, res) => {
  const data = await accessService.changeAdminRole(
    req.params.id,
    req.body.role,
  );

  return response.success(req, res, data, 200, "access.admin_role_updated");
});

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

exports.getMyProfile = catchAsync(async (req, res) => {
  const data = await accessService.getMyProfile(req.user.id);

  return response.success(req, res, data);
});

exports.updateMyProfile = catchAsync(async (req, res) => {
  const data = await accessService.updateMyProfile(req.user.id, req.body);

  return response.success(req, res, data, 200, "access.profile_updated");
});

/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

exports.changePassword = catchAsync(async (req, res) => {
  const data = await accessService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword,
  );

  return response.success(req, res, data, 200, "access.password_changed");
});

exports.resetAdminPassword = catchAsync(async (req, res) => {
  const data = await accessService.resetAdminPassword(
    req.params.id,
    req.body.newPassword,
  );

  return response.success(req, res, data, 200, "access.password_reset");
});

/*
|--------------------------------------------------------------------------
| ADMIN SESSIONS
|--------------------------------------------------------------------------
*/

exports.getMySessions = catchAsync(async (req, res) => {
  const data = await accessService.getMySessions(req.user.id);

  return response.success(req, res, data);
});

exports.revokeSession = catchAsync(async (req, res) => {
  const data = await accessService.revokeSession(req.params.id);

  return response.success(req, res, data, 200, "access.session_revoked");
});
