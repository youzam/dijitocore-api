const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const announcementService = require("./announcement.service");

/*
|--------------------------------------------------------------------------
| GET USER ANNOUNCEMENTS
|--------------------------------------------------------------------------
*/
exports.getUserAnnouncements = catchAsync(async (req, res) => {
  const data = await announcementService.getUserAnnouncements(req.user);

  return response.success(req, res, data, 200, "announcement.list_fetched");
});

/*
|--------------------------------------------------------------------------
| MARK AS READ
|--------------------------------------------------------------------------
*/
exports.markAsRead = catchAsync(async (req, res) => {
  const data = await announcementService.markAsRead(req.params.id, req.user.id);

  return response.success(req, res, data, 200, "announcement.marked_read");
});

/*
|--------------------------------------------------------------------------
| DISMISS ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.dismissAnnouncement = catchAsync(async (req, res) => {
  const data = await announcementService.dismissAnnouncement(
    req.params.id,
    req.user.id,
  );

  return response.success(req, res, data, 200, "announcement.dismissed");
});
