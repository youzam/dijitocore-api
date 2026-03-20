const express = require("express");

const router = express.Router();

const validate = require("../../../middlewares/validate.middleware");
const {
  authRateLimiter,
} = require("../../../middlewares/rateLimit.middleware");

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");

const accessController = require("./access.controller");

const {
  bootstrapSchema,
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  changePasswordSchema,
  updateProfileSchema,
  changeRoleSchema,
} = require("./access.validation");

/*
|--------------------------------------------------------------------------
| SYSTEM BOOTSTRAP
|--------------------------------------------------------------------------
*/

router.post(
  "/bootstrap",
  validate(bootstrapSchema),
  accessController.bootstrapSystem,
);

/*
|--------------------------------------------------------------------------
| SYSTEM SEED
|--------------------------------------------------------------------------
*/

router.post(
  "/seed",
  auth,
  requirePermission({
    module: "ACCESS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  accessController.runSeed,
);

/*
|--------------------------------------------------------------------------
| ADMIN LOGIN
|--------------------------------------------------------------------------
*/

router.post(
  "/login",
  authRateLimiter,
  validate(adminLoginSchema),
  accessController.adminLogin,
);

router.post("/refresh-token", accessController.refreshToken);

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
router.post("/mfa/setup", accessController.setupAdminMFA);

router.post("/mfa/verify", accessController.verifyAdminMFASetup);

router.post("/mfa/disable", accessController.disableAdminMFA);

router.post(
  "/admins",
  requirePermission({
    module: "ACCESS",
    action: "CREATE",
    scope: "SYSTEM",
  }),
  validate(createAdminSchema),
  accessController.createAdmin,
);

router.get(
  "/admins",
  requirePermission({
    module: "ACCESS",
    action: "READ",
    scope: "SYSTEM",
  }),
  accessController.listAdmins,
);

router.get(
  "/admins/:id",
  requirePermission({
    module: "ACCESS",
    action: "READ",
    scope: "SYSTEM",
  }),
  accessController.getAdmin,
);

router.patch(
  "/admins/:id",
  requirePermission({
    module: "ACCESS",
    action: "UPDATE",
    scope: "SYSTEM",
  }),
  validate(updateAdminSchema),
  accessController.updateAdmin,
);

router.patch(
  "/admins/:id/suspend",
  requirePermission({
    module: "ACCESS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  accessController.suspendAdmin,
);

router.post("/logout", accessController.logoutAdmin);

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT
|--------------------------------------------------------------------------
*/

router.get(
  "/roles",
  requirePermission({
    module: "ACCESS",
    action: "READ",
    scope: "SYSTEM",
  }),
  accessController.listRoles,
);

router.patch(
  "/admins/:id/role",
  requirePermission({
    module: "ACCESS",
    action: "UPDATE",
    scope: "SYSTEM",
  }),
  validate(changeRoleSchema),
  accessController.changeAdminRole,
);

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

router.get("/me", accessController.getMyProfile);

router.patch(
  "/me",
  validate(updateProfileSchema),
  accessController.updateMyProfile,
);

/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

router.patch(
  "/change-password",
  validate(changePasswordSchema),
  accessController.changePassword,
);

router.patch(
  "/admins/:id/reset-password",
  requirePermission({
    module: "ACCESS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  accessController.resetAdminPassword,
);

/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

router.get("/sessions", accessController.getMySessions);

router.delete("/sessions/:id", accessController.revokeSession);

/*
|--------------------------------------------------------------------------
| ROLE MANAGEMENT EXTENSIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/roles/:id",
  requirePermission({
    module: "ACCESS",
    action: "READ",
    scope: "SYSTEM",
  }),
  accessController.getRole,
);

router.post(
  "/roles",
  requirePermission({
    module: "ACCESS",
    action: "CREATE",
    scope: "SYSTEM",
  }),
  accessController.createRole,
);

router.patch(
  "/roles/:id",
  requirePermission({
    module: "ACCESS",
    action: "UPDATE",
    scope: "SYSTEM",
  }),
  accessController.updateRole,
);

router.patch(
  "/roles/:id/activate",
  requirePermission({
    module: "ACCESS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  accessController.activateRole,
);

router.patch(
  "/roles/:id/deactivate",
  requirePermission({
    module: "ACCESS",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  accessController.deactivateRole,
);

module.exports = router;
