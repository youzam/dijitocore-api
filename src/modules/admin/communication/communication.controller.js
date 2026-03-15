const communicationService = require("../services/communication.service");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

/*
|--------------------------------------------------------------------------
| Announcement Controllers
|--------------------------------------------------------------------------
*/

exports.createAnnouncement = catchAsync(async (req, res) => {
  const data = req.body;
  const adminId = req.user.id;

  const result = await communicationService.createAnnouncement(data, adminId);

  return response.success(
    res,
    req.t("communication.announcement_created"),
    result,
  );
});

exports.updateAnnouncement = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await communicationService.updateAnnouncement(id, req.body);

  return response.success(
    res,
    req.t("communication.announcement_updated"),
    result,
  );
});

exports.deleteAnnouncement = catchAsync(async (req, res) => {
  const { id } = req.params;

  await communicationService.deleteAnnouncement(id);

  return response.success(res, req.t("communication.announcement_deleted"));
});

exports.getAnnouncements = catchAsync(async (req, res) => {
  const result = await communicationService.getAnnouncements(req.query);

  return response.success(
    res,
    req.t("communication.announcements_fetched"),
    result,
  );
});

exports.getAnnouncementById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await communicationService.getAnnouncementById(id);

  return response.success(
    res,
    req.t("communication.announcement_fetched"),
    result,
  );
});

/*
|--------------------------------------------------------------------------
| Messaging Controllers
|--------------------------------------------------------------------------
*/

exports.sendBroadcast = catchAsync(async (req, res) => {
  const adminId = req.user.id;

  const result = await communicationService.sendBroadcast(req.body, adminId);

  return response.success(res, req.t("communication.broadcast_sent"), result);
});

exports.sendBatch = catchAsync(async (req, res) => {
  const adminId = req.user.id;

  const result = await communicationService.sendBatch(req.body, adminId);

  return response.success(res, req.t("communication.batch_sent"), result);
});

exports.retryFailedMessages = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const result = await communicationService.retryFailedMessages(messageId);

  return response.success(res, req.t("communication.retry_success"), result);
});

exports.getMessageStats = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const result = await communicationService.getMessageDeliveryStats(messageId);

  return response.success(res, req.t("communication.stats_fetched"), result);
});

/*
|--------------------------------------------------------------------------
| Template Controllers
|--------------------------------------------------------------------------
*/

exports.createTemplate = catchAsync(async (req, res) => {
  const result = await communicationService.createTemplate(req.body);

  return response.success(res, req.t("communication.template_created"), result);
});

exports.updateTemplate = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await communicationService.updateTemplate(id, req.body);

  return response.success(res, req.t("communication.template_updated"), result);
});

exports.deleteTemplate = catchAsync(async (req, res) => {
  const { id } = req.params;

  await communicationService.deleteTemplate(id);

  return response.success(res, req.t("communication.template_deleted"));
});

exports.getTemplates = catchAsync(async (req, res) => {
  const result = await communicationService.getTemplates();

  return response.success(
    res,
    req.t("communication.templates_fetched"),
    result,
  );
});

exports.getTemplateById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await communicationService.getTemplateById(id);

  return response.success(res, req.t("communication.template_fetched"), result);
});
