const express = require("express");
const router = express.Router();

const controller = require("./business.controller");
const validation = require("./business.validation");

const auth = require("../../middlewares/auth.middleware");
const role = require("../../middlewares/role.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const validate = require("../../middlewares/validate.middleware");

/**
 * All routes require authentication
 */
router.use(auth);

/**
 * BUSINESS ONBOARDING
 */
router.post(
  "/",
  validate(validation.createBusiness),
  controller.createBusiness,
);

/**
 * BUSINESS SETTINGS (OWNER)
 */
router.get(
  "/me/settings",
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.getBusinessSettings,
);

router.put(
  "/me/settings",
  tenant,
  role(["BUSINESS_OWNER"]),
  validate(validation.updateSettings),
  controller.updateBusinessSettings,
);

router.get(
  "/:businessId",
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.getBusinessDetails,
);

module.exports = router;
