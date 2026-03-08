const catchAsync = require("../../../utils/catchAsync");
const prisma = require("../../../config/prisma");
const { success } = require("../../../utils/response");
const operationService = require("./operation.service");
const jobs = require("../../../jobs");
const { runSafeJob } = require("../../../utils/jobRunner");

exports.getHealth = catchAsync(async (req, res) => {
  const health = await operationService.getSystemHealth();

  return success(req, res, health, 200, "system.healthFetched");
});

exports.triggerJob = async (req, res) => {
  const { jobName } = req.params;

  const job = jobs[jobName];

  if (!job || typeof job.run !== "function") {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  try {
    await runSafeJob(jobName, job.run, 1800);

    return res.json({
      success: true,
      message: `Job '${jobName}' triggered`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Job execution failed",
      error: error.message,
    });
  }
};

exports.getJobs = catchAsync(async (req, res) => {
  const jobs = await prisma.systemJobLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  return success(req, res, jobs, 200, "system.jobLogged");
});
