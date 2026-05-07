const Joi = require('joi');

/*
|--------------------------------------------------------------------------
| Create Ticket
|--------------------------------------------------------------------------
*/
exports.createTicket = Joi.object({
  subject: Joi.string().min(3).max(255).required(),
  description: Joi.string().min(5).required(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
});

/*
|--------------------------------------------------------------------------
| Reply to Ticket
|--------------------------------------------------------------------------
*/
exports.replyTicket = Joi.object({
  message: Joi.string().min(1).required(),
});
