const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

const supportService = require("./support.service");

/*
|--------------------------------------------------------------------------
| Ticket CRUD
|--------------------------------------------------------------------------
*/

exports.createTicket = catchAsync(async (req, res) => {
  const data = await supportService.createTicket(req.body);

  return response.success(res, data, "support.ticket_created");
});

exports.getTickets = catchAsync(async (req, res) => {
  const data = await supportService.getTickets(req.query);

  return response.success(res, data, "support.tickets_fetched");
});

exports.getTicket = catchAsync(async (req, res) => {
  const data = await supportService.getTicketById(req.params.id);

  return response.success(res, data, "support.ticket_fetched");
});

exports.updateTicket = catchAsync(async (req, res) => {
  const data = await supportService.updateTicket(req.params.id, req.body);

  return response.success(res, data, "support.ticket_updated");
});

exports.deleteTicket = catchAsync(async (req, res) => {
  await supportService.deleteTicket(req.params.id);

  return response.success(res, null, "support.ticket_deleted");
});

/*
|--------------------------------------------------------------------------
| Assignment & Workflow
|--------------------------------------------------------------------------
*/

exports.assignTicket = catchAsync(async (req, res) => {
  const data = await supportService.assignTicket(
    req.params.id,
    req.body.adminId,
  );

  return response.success(res, data, "support.ticket_assigned");
});

exports.changePriority = catchAsync(async (req, res) => {
  const data = await supportService.changePriority(
    req.params.id,
    req.body.priority,
  );

  return response.success(res, data, "support.priority_updated");
});

exports.changeStatus = catchAsync(async (req, res) => {
  const data = await supportService.changeStatus(
    req.params.id,
    req.body.status,
  );

  return response.success(res, data, "support.status_updated");
});

/*
|--------------------------------------------------------------------------
| Internal Notes
|--------------------------------------------------------------------------
*/

exports.addInternalNote = catchAsync(async (req, res) => {
  const data = await supportService.addInternalNote(
    req.params.id,
    req.user.id,
    req.body.note,
  );

  return response.success(res, data, "support.note_added");
});

exports.getInternalNotes = catchAsync(async (req, res) => {
  const data = await supportService.getInternalNotes(req.params.id);

  return response.success(res, data, "support.notes_fetched");
});

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

exports.addMessage = catchAsync(async (req, res) => {
  const data = await supportService.addMessage(
    req.params.id,
    req.user.id,
    req.body.senderType,
    req.body.message,
  );

  return response.success(res, data, "support.message_sent");
});

exports.getMessages = catchAsync(async (req, res) => {
  const data = await supportService.getMessages(req.params.id);

  return response.success(res, data, "support.messages_fetched");
});

/*
|--------------------------------------------------------------------------
| Attachments
|--------------------------------------------------------------------------
*/

exports.addAttachment = catchAsync(async (req, res) => {
  const data = await supportService.addAttachment(
    req.params.id,
    req.body.fileUrl,
  );

  return response.success(res, data, "support.attachment_added");
});

exports.getAttachments = catchAsync(async (req, res) => {
  const data = await supportService.getAttachments(req.params.id);

  return response.success(res, data, "support.attachments_fetched");
});

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

exports.getAnalytics = catchAsync(async (req, res) => {
  const data = await supportService.getTicketAnalytics();

  return response.success(res, data, "support.analytics_fetched");
});

/*
|--------------------------------------------------------------------------
| Business View
|--------------------------------------------------------------------------
*/

exports.getBusinessTickets = catchAsync(async (req, res) => {
  const data = await supportService.getTicketsByBusiness(req.params.businessId);

  return response.success(res, data, "support.business_tickets_fetched");
});

exports.downloadAttachment = catchAsync(async (req, res) => {
  const result = await ticketService.downloadAttachment({
    user: req.user,
    ticketId: req.params.id,
    attachmentId: req.params.attachmentId,
  });

  // 🔥 HANDLE BOTH CASES
  if (result.type === "url") {
    return success(req, res, { url: result.value }, 200, "file.download_url");
  }

  if (result.type === "stream") {
    res.setHeader("Content-Type", "application/octet-stream");
    return result.value.pipe(res);
  }
});
