const { runSafeJob, gracefulShutdown } = require("../utils/jobRunner");

const dashboardSnapshotJob = require("./dashboard.snapshot.job");
const deviceCleanupJob = require("./device.cleanup.job");
const escalationJob = require("./escalation.job");
const reminderJob = require("./reminder.job");
const notificationRetryJob = require("./notification.job");
const subscriptionLifecycleJob = require("./subscription.lifecycle.job");
const complianceJob = require("./compliance.job");
const apiMetricsJob = require("./api.metrics.job");

/**
 * Central Job Registry
 * Used by:
 * - Scheduler
 * - Admin manual trigger
 */
const jobRegistry = {
  dashboard_snapshot: dashboardSnapshotJob,
  device_cleanup: deviceCleanupJob,
  escalation: escalationJob,
  reminder: reminderJob,
  retry: notificationRetryJob,
  subscription_lifecycle: subscriptionLifecycleJob,
  compliance: complianceJob,
  api_metrics: apiMetricsJob,
};

function scheduleJob(jobName, jobFn, intervalMs, ttlSeconds, intervals) {
  // Run immediately on boot
  runSafeJob(jobName, jobFn, ttlSeconds);

  // Schedule recurring
  intervals.push(
    setInterval(async () => {
      await runSafeJob(jobName, jobFn, ttlSeconds);
    }, intervalMs),
  );
}

function startJobs() {
  const intervals = [];

  // Heavy jobs → 30 min TTL
  scheduleJob(
    "dashboard_snapshot",
    dashboardSnapshotJob.run,
    60 * 60 * 1000,
    1800,
    intervals,
  );

  scheduleJob(
    "subscription_lifecycle",
    subscriptionLifecycleJob.run,
    60 * 60 * 1000,
    1800,
    intervals,
  );

  // Medium jobs → 15 min TTL
  scheduleJob(
    "device_cleanup",
    deviceCleanupJob.run,
    60 * 60 * 1000,
    900,
    intervals,
  );

  scheduleJob("reminder", reminderJob.run, 60 * 60 * 1000, 900, intervals);

  // Fast jobs → 10 min TTL
  scheduleJob("escalation", escalationJob.run, 10 * 60 * 1000, 600, intervals);

  scheduleJob(
    "retry",
    notificationRetryJob.run,
    10 * 60 * 1000,
    600,
    intervals,
  );

  scheduleJob(
    "compliance",
    complianceJob.run,
    10 * 60 * 1000, // every 10 minutes
    600,
    intervals,
  );

  scheduleJob(
    "api_metrics",
    apiMetricsJob.run,
    5 * 60 * 1000, // every 5 minutes
    300, // TTL (5 min)
    intervals,
  );

  gracefulShutdown(intervals);
}

module.exports = {
  startJobs,
  jobRegistry,
};
