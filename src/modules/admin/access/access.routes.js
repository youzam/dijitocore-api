const express = require('express');

const router = express.Router();

const validate = require('../../../middlewares/validate.middleware');
const {
  authRateLimiter,
} = require('../../../middlewares/rateLimit.middleware');

const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');

const PERMISSIONS = require('../../../utils/permission.constants');

const accessController = require('./access.controller');

const {
  bootstrapSchema,
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  changePasswordSchema,
  updateProfileSchema,
  changeRoleSchema,
} = require('./access.validation');

/*
|--------------------------------------------------------------------------
| SYSTEM BOOTSTRAP
|--------------------------------------------------------------------------
*/

router.post(
  '/bootstrap',
  validate(bootstrapSchema),
  accessController.bootstrapSystem,
);

/*
|--------------------------------------------------------------------------
| SYSTEM SEED
|--------------------------------------------------------------------------
*/

router.post(
  '/seed',
  auth,
  requirePermission(PERMISSIONS.ACCESS_ADMIN_EXECUTE_SYSTEM),
  accessController.runSeed,
);

/*
|--------------------------------------------------------------------------
| ADMIN LOGIN
|--------------------------------------------------------------------------
*/

router.post(
  '/login',
  authRateLimiter,
  validate(adminLoginSchema),
  accessController.adminLogin,
);

router.post('/refresh-token', accessController.refreshToken);

/*
|--------------------------------------------------------------------------
| AUTHENTICATED ROUTES
|--------------------------------------------------------------------------
*/

router.use(auth);

/*
|--------------------------------------------------------------------------
| ADMIN MANAGEMENT
|--------------------------------------------------------------------------
*/

router.post('/mfa/setup', accessController.setupAdminMFA);

router.post('/mfa/verify', accessController.verifyAdminMFASetup);

router.post('/mfa/disable', accessController.disableAdminMFA);

router.post(
  '/admins',
  requirePermission(PERMISSIONS.ACCESS_ADMIN_CREATE_SYSTEM),
  validate(createAdminSchema),
  accessController.createAdmin,
);

router.get(
  '/admins',
  requirePermission(PERMISSIONS.ACCESS_ADMIN_READ_SYSTEM),
  accessController.listAdmins,
);

router.get(
  '/admins/:id',
  requirePermission(PERMISSIONS.ACCESS_ADMIN_READ_SYSTEM),
  accessController.getAdmin,
);

router.patch(
  '/admins/:id',
  requirePermission(PERMISSIONS.ACCESS_ADMIN_UPDATE_SYSTEM),
  validate(updateAdminSchema),
  accessController.updateAdmin,
);

router.patch(
  '/admins/:id/suspend',
  requirePermission(PERMISSIONS.ACCESS_ADMINSUSPEND_EXECUTE_SYSTEM),
  accessController.suspendAdmin,
);

router.post('/logout', accessController.logoutAdmin);

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT
|--------------------------------------------------------------------------
*/

router.get(
  '/roles',
  requirePermission(PERMISSIONS.ACCESS_ROLE_READ_SYSTEM),
  accessController.listRoles,
);

router.patch(
  '/admins/:id/role',
  requirePermission(PERMISSIONS.ACCESS_ROLE_UPDATE_SYSTEM),
  validate(changeRoleSchema),
  accessController.changeAdminRole,
);

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

router.get('/me', accessController.getMyProfile);

router.patch(
  '/me',
  validate(updateProfileSchema),
  accessController.updateMyProfile,
);

/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

router.patch(
  '/change-password',
  validate(changePasswordSchema),
  accessController.changePassword,
);

router.patch(
  '/admins/:id/reset-password',
  requirePermission(PERMISSIONS.ACCESS_ADMINPASSWORDRESET_EXECUTE_SYSTEM),
  accessController.resetAdminPassword,
);

/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

router.get('/sessions', accessController.getMySessions);

router.delete('/sessions/:id', accessController.deleteSession);

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT EXTENSIONS
|--------------------------------------------------------------------------
*/

router.get(
  '/roles/:id',
  requirePermission(PERMISSIONS.ACCESS_ROLE_READ_SYSTEM),
  accessController.getRole,
);

router.post(
  '/roles',
  requirePermission(PERMISSIONS.ACCESS_ROLE_CREATE_SYSTEM),
  accessController.createRole,
);

router.patch(
  '/roles/:id',
  requirePermission(PERMISSIONS.ACCESS_ROLE_UPDATE_SYSTEM),
  accessController.updateRole,
);

router.patch(
  '/roles/:id/activate',
  requirePermission(PERMISSIONS.ACCESS_ROLEACTIVATE_EXECUTE_SYSTEM),
  accessController.activateRole,
);

router.patch(
  '/roles/:id/deactivate',
  requirePermission(PERMISSIONS.ACCESS_ROLEDEACTIVATE_EXECUTE_SYSTEM),
  accessController.deactivateRole,
);

module.exports = router;
