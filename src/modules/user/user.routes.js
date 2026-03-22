const express = require("express");
const controller = require("./user.controller");

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");
const subscriptionFeature = require("../../middlewares/subscriptionFeature.middleware");

const router = express.Router();

// INVITE
router.post(
  "/invite",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  subscriptionFeature("allowMultiUser"),
  controller.inviteUser,
);

// ACCEPT
router.post("/accept-invite", controller.acceptInvite);

// INVITES
router.get(
  "/invites",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.listInvites,
);

router.delete(
  "/invites/:id",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.revokeInvite,
);

// USERS
router.get("/", auth, tenant, role(["BUSINESS_OWNER"]), controller.listUsers);

router.patch(
  "/:id",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.updateUser,
);

router.patch(
  "/:id/activate",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.activateUser,
);

router.patch(
  "/:id/deactivate",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.deactivateUser,
);

module.exports = router;
