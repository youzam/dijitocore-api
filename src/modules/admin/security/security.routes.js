const express = require("express");

const router = express.Router();

const authMiddleware = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");

const securityController = require("./security.controller");

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| ADMIN SECURITY ACTIONS
|--------------------------------------------------------------------------
*/

router.post(
  "/users/:userId/force-logout",
  requirePermission({
    module: "SECURITY",
    action: "EXECUTE",
    scope: "SYSTEM",
  }),
  securityController.forceLogoutUser,
);

module.exports = router;
