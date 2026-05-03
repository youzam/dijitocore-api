const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const ticketService = require("./ticket.service");

/*
|--------------------------------------------------------------------------
| Create Ticket
|--------------------------------------------------------------------------
*/
exports.createTicket = catchAsync(async (req, res) => {
  const ticket = await ticketService.createTicket({
    user: req.user,
    subject: req.body.subject,
    description: req.body.description,
    priority: req.body.priority,
  });

  return success(req, res, ticket, 201, "support.ticket_created");
});

/*
|--------------------------------------------------------------------------
| Get My Tickets
|--------------------------------------------------------------------------
*/
exports.getMyTickets = catchAsync(async (req, res) => {
  const result = await service.getMyTickets({
    user: req.user,
    query: req.query,
  });

  return response.success(req, res, result);
});

/*
|--------------------------------------------------------------------------
| Get Single Ticket
|--------------------------------------------------------------------------
*/
exports.getMyTicketById = catchAsync(async (req, res) => {
  const ticket = await ticketService.getMyTicketById({
    user: req.user,
    ticketId: req.params.id,
  });

  return success(req, res, ticket, 200, "support.ticket_fetched");
});

/*
|--------------------------------------------------------------------------
| Reply to Ticket
|--------------------------------------------------------------------------
*/
exports.replyToTicket = catchAsync(async (req, res) => {
  const message = await ticketService.replyToTicket({
    user: req.user,
    ticketId: req.params.id,
    message: req.body.message,
  });

  return success(req, res, message, 201, "support.message_sent");
});

/*
|--------------------------------------------------------------------------
| Add Attachment
|--------------------------------------------------------------------------
*/
exports.addAttachment = catchAsync(async (req, res) => {
  const files = req.files?.files;

  const result = await ticketService.addAttachment({
    user: req.user,
    ticketId: req.params.id,
    files: Array.isArray(files) ? files : [files],
  });

  return success(req, res, result, 201, "support.attachment_added");
});
