const express = require("express");
const router = express.Router();

const controller = require("../controllers/communication.controller");
const auth = require("../../middlewares/auth.middleware");
const requirePermission = require("../../middlewares/permission.middleware");
const validate = require("../../middlewares/validate.middleware");
const rateLimitCommunication = require("../../middlewares/rateLimit.communication");

const validation = require("../validations/communication.validation");

/*
|--------------------------------------------------------------------------
| Announcement Routes
|--------------------------------------------------------------------------
*/

router.post(
  "/announcements",
  auth,
  requirePermission({
    module: "communication",
    action: "create",
    scope: "GLOBAL",
  }),
  validate(validation.createAnnouncement),
  controller.createAnnouncement,
);

router.put(
  "/announcements/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "update",
    scope: "GLOBAL",
  }),
  validate(validation.updateAnnouncement),
  controller.updateAnnouncement,
);

router.delete(
  "/announcements/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "delete",
    scope: "GLOBAL",
  }),
  controller.deleteAnnouncement,
);

router.get(
  "/announcements",
  auth,
  requirePermission({
    module: "communication",
    action: "view",
    scope: "GLOBAL",
  }),
  controller.getAnnouncements,
);

router.get(
  "/announcements/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "view",
    scope: "GLOBAL",
  }),
  controller.getAnnouncementById,
);

/*
|--------------------------------------------------------------------------
| Messaging Routes (RATE LIMITED)
|--------------------------------------------------------------------------
*/

router.post(
  "/messages/broadcast",
  auth,
  rateLimitCommunication, // 🔥 PROTECTION
  requirePermission({
    module: "communication",
    action: "send",
    scope: "GLOBAL",
  }),
  validate(validation.sendBroadcast),
  controller.sendBroadcast,
);

router.post(
  "/messages/batch",
  auth,
  rateLimitCommunication, // 🔥 PROTECTION
  requirePermission({
    module: "communication",
    action: "send",
    scope: "GLOBAL",
  }),
  validate(validation.sendBatch),
  controller.sendBatch,
);

router.post(
  "/messages/retry/:messageId",
  auth,
  rateLimitCommunication, // 🔥 PROTECTION
  requirePermission({
    module: "communication",
    action: "send",
    scope: "GLOBAL",
  }),
  controller.retryFailedMessages,
);

router.get(
  "/messages/stats/:messageId",
  auth,
  requirePermission({
    module: "communication",
    action: "view",
    scope: "GLOBAL",
  }),
  controller.getMessageStats,
);

/*
|--------------------------------------------------------------------------
| Template Routes
|--------------------------------------------------------------------------
*/

router.post(
  "/templates",
  auth,
  requirePermission({
    module: "communication",
    action: "create",
    scope: "GLOBAL",
  }),
  validate(validation.createTemplate),
  controller.createTemplate,
);

router.put(
  "/templates/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "update",
    scope: "GLOBAL",
  }),
  validate(validation.updateTemplate),
  controller.updateTemplate,
);

router.delete(
  "/templates/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "delete",
    scope: "GLOBAL",
  }),
  controller.deleteTemplate,
);

router.get(
  "/templates",
  auth,
  requirePermission({
    module: "communication",
    action: "view",
    scope: "GLOBAL",
  }),
  controller.getTemplates,
);

router.get(
  "/templates/:id",
  auth,
  requirePermission({
    module: "communication",
    action: "view",
    scope: "GLOBAL",
  }),
  controller.getTemplateById,
);

module.exports = router;
