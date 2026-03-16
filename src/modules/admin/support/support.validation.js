const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| Reusable
|--------------------------------------------------------------------------
*/

const uuid = Joi.string().uuid();

/*
|--------------------------------------------------------------------------
| Ticket CRUD
|--------------------------------------------------------------------------
*/

exports.createTicket = Joi.object({
  businessId: uuid.required(),
  userId: uuid.optional(),
  subject: Joi.string().min(3).required(),
  description: Joi.string().min(3).required(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT").optional(),
});

exports.getTickets = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),

  status: Joi.string().optional(),
  priority: Joi.string().optional(),
  businessId: uuid.optional(),
  assignedAdminId: uuid.optional(),
});

exports.updateTicket = Joi.object({
  subject: Joi.string().min(3).optional(),
  description: Joi.string().min(3).optional(),
  status: Joi.string()
    .valid("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
    .optional(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT").optional(),
});

exports.ticketIdParam = Joi.object({
  id: uuid.required(),
});

/*
|--------------------------------------------------------------------------
| Assignment & Workflow
|--------------------------------------------------------------------------
*/

exports.assignTicket = Joi.object({
  adminId: uuid.required(),
});

exports.changePriority = Joi.object({
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT").required(),
});

exports.changeStatus = Joi.object({
  status: Joi.string()
    .valid("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
    .required(),
});

/*
|--------------------------------------------------------------------------
| Notes
|--------------------------------------------------------------------------
*/

exports.addNote = Joi.object({
  note: Joi.string().min(1).required(),
});

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

exports.addMessage = Joi.object({
  senderType: Joi.string().valid("ADMIN", "USER").required(),
  message: Joi.string().min(1).required(),
});

/*
|--------------------------------------------------------------------------
| Attachments
|--------------------------------------------------------------------------
*/

exports.addAttachment = Joi.object({
  fileUrl: Joi.string().uri().required(),
});

/*
|--------------------------------------------------------------------------
| Business View
|--------------------------------------------------------------------------
*/

exports.businessParam = Joi.object({
  businessId: uuid.required(),
});
