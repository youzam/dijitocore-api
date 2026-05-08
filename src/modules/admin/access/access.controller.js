const catchAsync = require('../../../utils/catchAsync');
const response = require('../../../utils/response');

const accessService = require('./access.service');
const handlerFactory = require('../../../utils/handlerFactory');

/*
|--------------------------------------------------------------------------
| SYSTEM BOOTSTRAP
|--------------------------------------------------------------------------
*/

exports.bootstrapSystem = catchAsync(async (req, res) => {
  const data = await accessService.bootstrapSystemService(req.body);

  return response.success(req, res, data, 201, 'access.system_bootstrapped');
});

/*
|--------------------------------------------------------------------------
| DATA SEED
|--------------------------------------------------------------------------
*/

exports.runSeed = catchAsync(async (req, res) => {
  const data = await accessService.runSystemSeed();

  return response.success(req, res, data, 200, 'system.system_seed_completed');
});

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/
exports.setupAdminMFA = catchAsync(async (req, res) => {
  const data = await accessService.setupAdminMFA(req.user.id);

  return response.success(req, res, data, 200, 'access.mfa_setup');
});

exports.verifyAdminMFASetup = catchAsync(async (req, res) => {
  const data = await accessService.verifyAdminMFASetup(
    req.user.id,
    req.body.token,
  );

  return response.success(req, res, data, 200, 'access.mfa_enabled');
});

exports.disableAdminMFA = catchAsync(async (req, res) => {
  const data = await accessService.disableAdminMFA(req.user.id, req.body.token);

  return response.success(req, res, data, 200, 'access.mfa_disabled');
});

exports.adminLogin = catchAsync(async (req, res) => {
  const data = await accessService.adminLogin(req.body, req);

  return response.success(req, res, data, 200, 'access.login_success');
});

exports.logoutAdmin = catchAsync(async (req, res) => {
  const data = await accessService.logoutAdmin(req.user.id);

  return response.success(req, res, data, 200, 'access.logout_success');
});

/*
|--------------------------------------------------------------------------
| ADMIN MANAGEMENT
|--------------------------------------------------------------------------
*/

exports.createAdmin = catchAsync(async (req, res) => {
  const data = await accessService.createAdmin(req.body, req.user);

  return response.success(req, res, data, 201, 'access.admin_created');
});

exports.listAdmins = handlerFactory.getAll('systemAdmin');

exports.getAdmin = catchAsync(async (req, res) => {
  const data = await accessService.getAdmin(req.params.id);

  return response.success(req, res, data);
});

exports.updateAdmin = catchAsync(async (req, res) => {
  const data = await accessService.updateAdmin(
    req.params.id,
    req.body,
    req.user,
  );

  return response.success(req, res, data, 200, 'access.admin_updated');
});

exports.suspendAdmin = catchAsync(async (req, res) => {
  const data = await accessService.suspendAdmin(req.params.id, req.user);

  return response.success(req, res, data, 200, 'access.admin_suspended');
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
    req.user,
  );

  return response.success(req, res, data, 200, 'access.admin_role_updated');
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

  return response.success(req, res, data, 200, 'access.profile_updated');
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

  return response.success(req, res, data, 200, 'access.password_changed');
});

exports.resetAdminPassword = catchAsync(async (req, res) => {
  const data = await accessService.resetAdminPassword(
    req.params.id,
    req.body.newPassword,
  );

  return response.success(req, res, data, 200, 'access.password_reset');
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

exports.deleteSession = catchAsync(async (req, res) => {
  const data = await accessService.deleteSession(req.params.id);

  return response.success(req, res, data, 200, 'access.session_revoked');
});

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT
|--------------------------------------------------------------------------
*/

exports.getRole = catchAsync(async (req, res) => {
  const data = await accessService.getRole(req.params.id);

  return response.success(req, res, data, 200, 'access.role_fetched');
});

exports.createRole = catchAsync(async (req, res) => {
  const data = await accessService.createRoleFromEnum(req.body.name, req.user);

  return response.success(req, res, data, 201, 'access.role_created');
});

exports.updateRole = catchAsync(async (req, res) => {
  const data = await accessService.updateRole(
    req.params.id,
    req.body,
    req.user,
  );

  return response.success(req, res, data, 200, 'access.role_updated');
});

exports.activateRole = catchAsync(async (req, res) => {
  const data = await accessService.activateRole(req.params.id, req.user);

  return response.success(req, res, data, 200, 'access.role_activated');
});

exports.deactivateRole = catchAsync(async (req, res) => {
  const data = await accessService.deactivateRole(req.params.id, req.user);

  return response.success(req, res, data, 200, 'access.role_deactivated');
});

/*
|--------------------------------------------------------------------------
| AUTH EXTENSIONS
|--------------------------------------------------------------------------
*/

exports.refreshToken = catchAsync(async (req, res) => {
  const data = await accessService.refreshToken(req.body);

  return response.success(req, res, data, 200, 'access.token_refreshed');
});
