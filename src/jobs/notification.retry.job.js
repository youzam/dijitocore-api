const {
  retryNotifications,
} = require("../services/notifications/notification.service");

const jobService = require("../modules/system/system.job.service");

module.exports.start = () => {
  setInterval(
    async () => {
      const startedAt = new Date();

      try {
        await retryNotifications();

        // ✅ SUCCESS LOG
        await jobService.logJobExecution({
          jobName: "notification_retry_job",
          status: "success",
          startedAt,
          finishedAt: new Date(),
        });
      } catch (error) {
        // ❌ FAILURE LOG
        await jobService.logJobExecution({
          jobName: "notification_retry_job",
          status: "failed",
          startedAt,
          finishedAt: new Date(),
          errorMessage: error.message,
        });

        // Important: do NOT throw
        // If we throw inside setInterval, it may crash the process
        console.error("Notification retry job failed:", error);
      }
    },
    5 * 60 * 1000,
  );
};
