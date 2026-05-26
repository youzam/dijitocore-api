const catchAsync = require('../../utils/catchAsync');
const response = require('../../utils/response');
const privacyService = require('./privacy.service');
const exportService = require('../../services/export.service');

exports.createDataRequest = catchAsync(async (req, res) => {
  const data = await privacyService.createDataRequest(req.body, req.user);
  return response.success(req, res, data, 201, 'privacy.request_created');
});

exports.getMyDataRequests = catchAsync(async (req, res) => {
  const data = await privacyService.getMyDataRequests(req.user);
  return response.success(req, res, data, 200, 'privacy.requests_list');
});

exports.getMyDataRequestById = catchAsync(async (req, res) => {
  const data = await privacyService.getMyDataRequestById(
    req.params.id,
    req.user,
  );
  return response.success(req, res, data, 200, 'privacy.request_details');
});

exports.getMyConsents = catchAsync(async (req, res) => {
  const data = await privacyService.getMyConsents(req.user);
  return response.success(req, res, data, 200, 'privacy.consent_list');
});

exports.downloadExport = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await exportService.downloadExport(id, req.user);

  if (result.type === 'url') {
    return response.success(
      req,
      res,
      { url: result.value },
      200,
      'export.ready',
    );
  }

  if (result.type === 'stream') {
    res.setHeader('Content-Type', 'application/json');
    return result.value.pipe(res);
  }
});
