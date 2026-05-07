const express = require('express');
const router = express.Router();

const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validate = require('../../../middlewares/validate.middleware');

const controller = require('./support.controller');
const validation = require('./support.validation');

const PERMISSIONS = require('../../../utils/permission.constants');

router.use(auth);

/*
|--------------------------------------------------------------------------
| Ticket CRUD
|--------------------------------------------------------------------------
*/

router.post(
  '/tickets',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_CREATE_SYSTEM),
  validate(validation.createTicket),
  controller.createTicket,
);

router.get(
  '/tickets',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_READ_SYSTEM),
  validate(validation.getTickets),
  controller.getTickets,
);

router.get(
  '/tickets/:id',
  requirePermission(PERMISSIONS.SUPPORT_TICKETBYID_READ_SYSTEM),
  validate(validation.ticketIdParam),
  controller.getTicket,
);

router.patch(
  '/tickets/:id',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_UPDATE_SYSTEM),
  validate(validation.updateTicket),
  controller.updateTicket,
);

router.delete(
  '/tickets/:id',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_DELETE_SYSTEM),
  validate(validation.ticketIdParam),
  controller.deleteTicket,
);

/*
|--------------------------------------------------------------------------
| Assignment
|--------------------------------------------------------------------------
*/

router.patch(
  '/tickets/:id/assign',
  requirePermission(PERMISSIONS.SUPPORT_TICKETASSIGN_EXECUTE_SYSTEM),
  validate(validation.assignTicket),
  controller.assignTicket,
);

/*
|--------------------------------------------------------------------------
| Workflow
|--------------------------------------------------------------------------
*/

router.patch(
  '/tickets/:id/priority',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_UPDATE_SYSTEM),
  validate(validation.changePriority),
  controller.changePriority,
);

router.patch(
  '/tickets/:id/status',
  requirePermission(PERMISSIONS.SUPPORT_TICKET_UPDATE_SYSTEM),
  validate(validation.changeStatus),
  controller.changeStatus,
);

/*
|--------------------------------------------------------------------------
| Notes
|--------------------------------------------------------------------------
*/

router.post(
  '/tickets/:id/notes',
  requirePermission(PERMISSIONS.SUPPORT_TICKETNOTE_CREATE_SYSTEM),
  validate(validation.addNote),
  controller.addInternalNote,
);

router.get(
  '/tickets/:id/notes',
  requirePermission(PERMISSIONS.SUPPORT_TICKETNOTE_READ_SYSTEM),
  controller.getInternalNotes,
);

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

router.post(
  '/tickets/:id/messages',
  requirePermission(PERMISSIONS.SUPPORT_TICKETMESSAGE_CREATE_SYSTEM),
  validate(validation.addMessage),
  controller.addMessage,
);

router.get(
  '/tickets/:id/messages',
  requirePermission(PERMISSIONS.SUPPORT_TICKETMESSAGE_READ_SYSTEM),
  controller.getMessages,
);

/*
|--------------------------------------------------------------------------
| Attachments
|--------------------------------------------------------------------------
*/

router.post(
  '/tickets/:id/attachments',
  requirePermission(PERMISSIONS.SUPPORT_TICKETATTACHMENT_CREATE_SYSTEM),
  validate(validation.addAttachment),
  controller.addAttachment,
);

router.get(
  '/tickets/:id/attachments',
  requirePermission(PERMISSIONS.SUPPORT_TICKETATTACHMENT_READ_SYSTEM),
  controller.getAttachments,
);

router.get(
  '/tickets/:id/attachments/:attachmentId/download',
  requirePermission(PERMISSIONS.SUPPORT_ATTACHMENTDOWNLOAD_EXECUTE_SYSTEM),
  controller.downloadAttachment,
);

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

router.get(
  '/analytics',
  requirePermission(PERMISSIONS.SUPPORT_ANALYTICS_READ_SYSTEM),
  controller.getAnalytics,
);

/*
|--------------------------------------------------------------------------
| Business View
|--------------------------------------------------------------------------
*/

router.get(
  '/business/:businessId',
  requirePermission(PERMISSIONS.SUPPORT_BUSINESS_READ_SYSTEM),
  validate(validation.businessParam),
  controller.getBusinessTickets,
);

module.exports = router;
