const {
  retryNotifications,
} = require("../services/notifications/notification.service");

const jobService = require("../modules/system/system.job.service");

/**
 * Retry failed notifications
 * Runs hourly
 */
module.exports = async () => {
  const startedAt = new Date();

  try {
    await retryNotifications();

    // ✅ SUCCESS LOG
    await jobService.logJobExecution({
      jobName: "retry_job",
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (error) {
    // ❌ FAILURE LOG
    await jobService.logJobExecution({
      jobName: "retry_job",
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: error.message,
    });

    throw error; // preserve original behavior
  }
};
