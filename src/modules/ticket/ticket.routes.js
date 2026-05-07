const express = require('express');

const router = express.Router();

const ticketController = require('./ticket.controller');
const ticketValidation = require('./ticket.validation');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const tenant = require('../../middlewares/tenant.middleware');
const validate = require('../../middlewares/validate.middleware');

/*
|--------------------------------------------------------------------------
| Ticket Routes (Tenant)
|--------------------------------------------------------------------------
*/

// 🔹 Create Ticket (BUSINESS_OWNER only)
router.post(
  '/',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(ticketValidation.createTicket), // adjust if validator exists
  ticketController.createTicket,
);

// 🔹 Get My Tickets
router.get(
  '/',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  ticketController.getMyTickets,
);

// 🔹 Get Single Ticket
router.get(
  '/:id',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  ticketController.getMyTicketById,
);

// 🔹 Reply to Ticket
router.post(
  '/:id/message',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(ticketValidation.replyTicket), // optional
  ticketController.replyToTicket,
);

// 🔹 Add Attachment
router.post(
  '/:id/attachment',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  ticketController.addAttachment,
);

module.exports = router;
