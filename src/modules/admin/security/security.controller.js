const catchAsync = require("../../../utils/catchAsync");
const prisma = require("../../../config/prisma");
const { success } = require("../../../utils/response");
const securityService = require("./security.service");

exports.getErrors = catchAsync(async (req, res) => {
  const errors = await prisma.systemErrorGroup.findMany({
    orderBy: { lastSeenAt: "desc" },
    include: { errors: true },
  });

  return success(req, res, errors, 200, "system.errorLogged");
});

exports.createIncident = catchAsync(async (req, res) => {
  const incident = await securityService.createIncident(req.body, req.user.id);

  return success(req, res, incident, 201, "incident.created");
});

exports.updateIncident = catchAsync(async (req, res) => {
  const incident = await securityService.updateIncident(
    req.params.id,
    req.body,
  );

  return success(req, res, incident, 200, "incident.updated");
});

exports.runChecks = catchAsync(async (req, res) => {
  const result = await securityService.runIntegrityChecks();

  return success(req, res, result, 200, "system.integrityChecked");
});
