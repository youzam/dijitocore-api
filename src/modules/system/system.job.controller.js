const jobs = require("../../jobs");
const { runSafeJob } = require("../../utils/jobRunner");

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
