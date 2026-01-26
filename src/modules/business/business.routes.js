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
 * BUSINESS LIFECYCLE (SYSTEM)
 */
router.post(
  "/:businessId/activate",
  role("SUPER_ADMIN"),
  controller.activateBusiness,
);
router.post("/:businessId/grace", role("SUPER_ADMIN"), controller.moveToGrace);
router.post(
  "/:businessId/suspend",
  role("SUPER_ADMIN"),
  controller.suspendBusiness,
);
router.post(
  "/:businessId/terminate",
  role("SUPER_ADMIN"),
  controller.terminateBusiness,
);

/**
 * BUSINESS SETTINGS (OWNER)
 */
router.get(
  "/me/settings",
  tenant,
  role("BUSINESS_OWNER"),
  controller.getBusinessSettings,
);

router.put(
  "/me/settings",
  tenant,
  role("BUSINESS_OWNER"),
  validate(validation.updateSettings),
  controller.updateBusinessSettings,
);

/**
 * BUSINESS USERS — INVITE FLOW (OWNER)
 */
router.post(
  "/me/users/invite",
  tenant,
  role("BUSINESS_OWNER"),
  validate(validation.inviteUser),
  controller.inviteBusinessUser,
);

router.get(
  "/me/users/invites",
  tenant,
  role("BUSINESS_OWNER"),
  controller.listInvites,
);

router.delete(
  "/me/users/invites/:inviteId",
  tenant,
  role("BUSINESS_OWNER"),
  controller.revokeInvite,
);

/**
 * ACTIVE BUSINESS USERS
 */
router.get("/me/users", tenant, controller.listBusinessUsers);

router.put(
  "/me/users/:userId",
  tenant,
  role("BUSINESS_OWNER"),
  validate(validation.updateUser),
  controller.updateBusinessUser,
);

router.delete(
  "/me/users/:userId",
  tenant,
  role("BUSINESS_OWNER"),
  controller.deactivateBusinessUser,
);

router.post(
  "/me/users/:userId/activate",
  tenant,
  role("BUSINESS_OWNER"),
  controller.activateBusinessUser,
);

module.exports = router;
