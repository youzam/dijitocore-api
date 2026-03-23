const express = require("express");
const router = express.Router();

const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");
const validate = require("../../../middlewares/validation.middleware");

const controller = require("./support.controller");
const validation = require("./support.validation");

router.use(auth);

/*
|--------------------------------------------------------------------------
| Ticket CRUD
|--------------------------------------------------------------------------
*/

router.post(
  "/tickets",
  requirePermission({ module: "SUPPORT", action: "CREATE" }),
  validate(validation.createTicket),
  controller.createTicket,
);

router.get(
  "/tickets",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  validate(validation.getTickets),
  controller.getTickets,
);

router.get(
  "/tickets/:id",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  validate(validation.ticketIdParam),
  controller.getTicket,
);

router.patch(
  "/tickets/:id",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.updateTicket),
  controller.updateTicket,
);

router.delete(
  "/tickets/:id",
  requirePermission({ module: "SUPPORT", action: "DELETE" }),
  validate(validation.ticketIdParam),
  controller.deleteTicket,
);

/*
|--------------------------------------------------------------------------
| Assignment
|--------------------------------------------------------------------------
*/

router.patch(
  "/tickets/:id/assign",
  requirePermission({ module: "SUPPORT", action: "ASSIGN" }),
  validate(validation.assignTicket),
  controller.assignTicket,
);

/*
|--------------------------------------------------------------------------
| Workflow
|--------------------------------------------------------------------------
*/

router.patch(
  "/tickets/:id/priority",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.changePriority),
  controller.changePriority,
);

router.patch(
  "/tickets/:id/status",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.changeStatus),
  controller.changeStatus,
);

/*
|--------------------------------------------------------------------------
| Notes
|--------------------------------------------------------------------------
*/

router.post(
  "/tickets/:id/notes",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.addNote),
  controller.addInternalNote,
);

router.get(
  "/tickets/:id/notes",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  controller.getInternalNotes,
);

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

router.post(
  "/tickets/:id/messages",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.addMessage),
  controller.addMessage,
);

router.get(
  "/tickets/:id/messages",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  controller.getMessages,
);

/*
|--------------------------------------------------------------------------
| Attachments
|--------------------------------------------------------------------------
*/

router.post(
  "/tickets/:id/attachments",
  requirePermission({ module: "SUPPORT", action: "UPDATE" }),
  validate(validation.addAttachment),
  controller.addAttachment,
);

router.get(
  "/tickets/:id/attachments",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  controller.getAttachments,
);

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

router.get(
  "/analytics",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  controller.getAnalytics,
);

/*
|--------------------------------------------------------------------------
| Business View
|--------------------------------------------------------------------------
*/

router.get(
  "/business/:businessId",
  requirePermission({ module: "SUPPORT", action: "READ" }),
  validate(validation.businessParam),
  controller.getBusinessTickets,
);

module.exports = router;
