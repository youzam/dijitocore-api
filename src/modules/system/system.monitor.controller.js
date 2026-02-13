const catchAsync = require("../../utils/catchAsync");
const prisma = require("../../config/prisma");
const { success } = require("../../utils/response");

exports.getJobs = catchAsync(async (req, res) => {
  const jobs = await prisma.systemJobLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  return success(req, res, jobs, 200, "system.jobLogged");
});

exports.getErrors = catchAsync(async (req, res) => {
  const errors = await prisma.systemErrorGroup.findMany({
    orderBy: { lastSeenAt: "desc" },
    include: { errors: true },
  });

  return success(req, res, errors, 200, "system.errorLogged");
});
