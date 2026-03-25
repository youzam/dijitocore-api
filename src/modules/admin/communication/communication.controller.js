const communicationService = require("../services/communication.service");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

/*
|--------------------------------------------------------------------------
| CREATE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.createAnnouncement = catchAsync(async (req, res) => {
  const data = await communicationService.createAnnouncement(
    req.body,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    201,
    "communication.announcement_created",
  );
});

/*
|--------------------------------------------------------------------------
| UPDATE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.updateAnnouncement = catchAsync(async (req, res) => {
  const data = await communicationService.updateAnnouncement(
    req.params.id,
    req.body,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "communication.announcement_updated",
  );
});

/*
|--------------------------------------------------------------------------
| DELETE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.deleteAnnouncement = catchAsync(async (req, res) => {
  const data = await communicationService.deleteAnnouncement(
    req.params.id,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "communication.announcement_deleted",
  );
});

/*
|--------------------------------------------------------------------------
| GET ALL ANNOUNCEMENTS (ADMIN)
|--------------------------------------------------------------------------
*/
exports.getAnnouncements = catchAsync(async (req, res) => {
  const data = await communicationService.getAnnouncements(req.query);

  return response.success(
    req,
    res,
    data,
    200,
    "communication.announcement_list",
  );
});

/*
|--------------------------------------------------------------------------
| GET SINGLE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.getAnnouncementById = catchAsync(async (req, res) => {
  const data = await communicationService.getAnnouncementById(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "communication.announcement_details",
  );
});

/*
|--------------------------------------------------------------------------
| Messaging Controllers
|--------------------------------------------------------------------------
*/

exports.sendBroadcast = catchAsync(async (req, res) => {
  const data = await communicationService.sendBroadcast(req.body, req.user.id);

  return response.success(req, res, data, 200, "communication.broadcast_sent");
});

exports.sendBatch = catchAsync(async (req, res) => {
  const data = await communicationService.sendBatch(req.body, req.user.id);

  return response.success(req, res, data, 200, "communication.batch_sent");
});

exports.retryFailedMessages = catchAsync(async (req, res) => {
  const data = await communicationService.retryFailedMessages();

  return response.success(req, res, data, 200, "communication.retry_success");
});

exports.getMessageStats = catchAsync(async (req, res) => {
  const data = await communicationService.getMessageDeliveryStats(
    req.params.messageId,
  );

  return response.success(req, res, data, 200, "communication.stats_fetched");
});

/*
|--------------------------------------------------------------------------
| Template Controllers
|--------------------------------------------------------------------------
*/

exports.createTemplate = catchAsync(async (req, res) => {
  const data = await communicationService.createTemplate(req.body, req.user.id);

  return response.success(
    req,
    res,
    data,
    201,
    "communication.template_created",
  );
});

exports.updateTemplate = catchAsync(async (req, res) => {
  const data = await communicationService.updateTemplate(
    req.params.id,
    req.body,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "communication.template_updated",
  );
});

exports.deleteTemplate = catchAsync(async (req, res) => {
  const data = await communicationService.deleteTemplate(
    req.params.id,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "communication.template_deleted",
  );
});

exports.getTemplates = catchAsync(async (req, res) => {
  const data = await communicationService.getTemplates();

  return response.success(
    req,
    res,
    data,
    200,
    "communication.templates_fetched",
  );
});

exports.getTemplateById = catchAsync(async (req, res) => {
  const data = await communicationService.getTemplateById(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "communication.template_fetched",
  );
});
