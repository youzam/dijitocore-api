const dashboardSnapshotJob = require("./dashboard.snapshot.job");
const reminderJob = require("./reminder.job");
const escalationJob = require("./escalation.job");
const retryJob = require("./retry.job");
const deviceCleanupJob = require("./device.cleanup.job");

/**
 * Helper: run daily at fixed hour (08:00 server time)
 */
const runDailyAt8AM = (jobFn) => {
  const now = new Date();
  const next = new Date();

  next.setHours(8, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    jobFn();

    // repeat every 24h after first run
    setInterval(jobFn, 1000 * 60 * 60 * 24);
  }, delay);
};

exports.startJobs = () => {
  /**
   * Existing snapshot job (UNCHANGED)
   */
  dashboardSnapshotJob.start();

  /**
   * Reminder job (daily 8AM)
   */
  runDailyAt8AM(async () => {
    try {
      await reminderJob();
    } catch (e) {
      console.error("Reminder job failed:", e);
    }
  });

  /**
   * Escalation job (daily 8:10AM, slightly after reminder)
   */
  runDailyAt8AM(async () => {
    setTimeout(
      async () => {
        try {
          await escalationJob();
        } catch (e) {
          console.error("Escalation job failed:", e);
        }
      },
      1000 * 60 * 10,
    ); // 10 minutes after reminder
  });

  /**
   * Retry failed notifications (hourly)
   */
  setInterval(
    async () => {
      try {
        await retryJob();
      } catch (e) {
        console.error("Retry job failed:", e);
      }
    },
    1000 * 60 * 60,
  );

  /**
   * Device token cleanup (daily, background)
   * - removes stale push tokens
   * - does NOT affect users
   */
  setInterval(
    async () => {
      try {
        await deviceCleanupJob();
      } catch (e) {
        console.error("Device cleanup job failed:", e);
      }
    },
    1000 * 60 * 60 * 24,
  );
};
