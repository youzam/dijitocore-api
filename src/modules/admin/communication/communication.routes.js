const express = require('express');
const router = express.Router();

const controller = require('./communication.controller');
const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validate = require('../../../middlewares/validate.middleware');
const rateLimitCommunication = require('../../../middlewares/rateLimit.communication');

const validation = require('./communication.validation');
const PERMISSIONS = require('../../../utils/permission.constants');

/*
|--------------------------------------------------------------------------
| Announcement Routes
|--------------------------------------------------------------------------
*/

router.post(
  '/announcements',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_ANNOUNCEMENT_CREATE_SYSTEM),
  validate(validation.createAnnouncement),
  controller.createAnnouncement,
);

router.put(
  '/announcements/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_ANNOUNCEMENT_UPDATE_SYSTEM),
  validate(validation.updateAnnouncement),
  controller.updateAnnouncement,
);

router.delete(
  '/announcements/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_ANNOUNCEMENT_DELETE_SYSTEM),
  controller.deleteAnnouncement,
);

router.get(
  '/announcements',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_ANNOUNCEMENT_READ_SYSTEM),
  controller.getAnnouncements,
);

router.get(
  '/announcements/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_ANNOUNCEMENTBYID_READ_SYSTEM),
  controller.getAnnouncementById,
);

/*
|--------------------------------------------------------------------------
| Messaging Routes (RATE LIMITED)
|--------------------------------------------------------------------------
*/

router.post(
  '/messages/broadcast',
  auth,
  rateLimitCommunication,
  requirePermission(PERMISSIONS.COMMUNICATION_MESSAGEBROADCAST_EXECUTE_SYSTEM),
  validate(validation.sendBroadcast),
  controller.sendBroadcast,
);

router.post(
  '/messages/batch',
  auth,
  rateLimitCommunication,
  requirePermission(PERMISSIONS.COMMUNICATION_MESSAGEBATCH_EXECUTE_SYSTEM),
  validate(validation.sendBatch),
  controller.sendBatch,
);

router.post(
  '/messages/retry',
  auth,
  rateLimitCommunication,
  requirePermission(PERMISSIONS.COMMUNICATION_MESSAGERETRY_EXECUTE_SYSTEM),
  controller.retryFailedMessages,
);

router.get(
  '/messages/stats/:messageId',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_MESSAGESTATS_READ_SYSTEM),
  controller.getMessageStats,
);

/*
|--------------------------------------------------------------------------
| Template Routes
|--------------------------------------------------------------------------
*/

router.post(
  '/templates',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_TEMPLATE_CREATE_SYSTEM),
  validate(validation.createTemplate),
  controller.createTemplate,
);

router.put(
  '/templates/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_TEMPLATE_UPDATE_SYSTEM),
  validate(validation.updateTemplate),
  controller.updateTemplate,
);

router.delete(
  '/templates/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_TEMPLATE_DELETE_SYSTEM),
  controller.deleteTemplate,
);

router.get(
  '/templates',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_TEMPLATE_READ_SYSTEM),
  controller.getTemplates,
);

router.get(
  '/templates/:id',
  auth,
  requirePermission(PERMISSIONS.COMMUNICATION_TEMPLATEBYID_READ_SYSTEM),
  controller.getTemplateById,
);

module.exports = router;
