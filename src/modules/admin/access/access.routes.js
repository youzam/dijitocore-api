const express = require("express");

const router = express.Router();

const validate = require("../../../middlewares/validate.middleware");
const {
  authRateLimiter,
} = require("../../../middlewares/rateLimit.middleware");

const accessController = require("./access.controller");

const { adminLoginSchema } = require("./access.validation");

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

module.exports = router;
