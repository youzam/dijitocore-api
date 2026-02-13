const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const incidentService = require("./system.incident.service");

exports.createIncident = catchAsync(async (req, res) => {
  const incident = await incidentService.createIncident(req.body, req.user.id);

  return success(req, res, incident, 201, "incident.created");
});

exports.updateIncident = catchAsync(async (req, res) => {
  const incident = await incidentService.updateIncident(
    req.params.id,
    req.body,
  );

  return success(req, res, incident, 200, "incident.updated");
});
