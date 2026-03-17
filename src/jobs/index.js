const cron = require("node-cron");

const { runSafeJob, gracefulShutdown } = require("../utils/jobRunner");

const dashboardSnapshotJob = require("./dashboard.snapshot.job");
const deviceCleanupJob = require("./device.cleanup.job");
const escalationJob = require("./escalation.job");
const reminderJob = require("./reminder.job");
const notificationRetryJob = require("./notification.job");
const subscriptionLifecycleJob = require("./subscription.lifecycle.job");
const complianceJob = require("./compliance.job");
const apiMetricsJob = require("./api.metrics.job");
const deadJobMonitor = require("./dead.job.monitor");

/*
|--------------------------------------------------------------------------
| Job Registry (UNCHANGED)
|--------------------------------------------------------------------------
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
  dead_job_monitor: deadJobMonitor,
};

/*
|--------------------------------------------------------------------------
| Cron Scheduler Wrapper
|--------------------------------------------------------------------------
*/

function scheduleCronJob(jobName, jobFn, cronExpression, ttlSeconds) {
  // Run immediately on boot (preserved behavior)
  runSafeJob(jobName, jobFn, ttlSeconds);

  const task = cron.schedule(cronExpression, async () => {
    await runSafeJob(jobName, jobFn, ttlSeconds);
  });

  return task;
}

/*
|--------------------------------------------------------------------------
| Start Jobs
|--------------------------------------------------------------------------
*/

function startJobs() {
  const tasks = [];

  // 🔴 HEAVY JOBS (1 hour)
  tasks.push(
    scheduleCronJob(
      "dashboard_snapshot",
      dashboardSnapshotJob.run,
      "0 * * * *",
      1800,
    ),
  );

  tasks.push(
    scheduleCronJob(
      "subscription_lifecycle",
      subscriptionLifecycleJob.run,
      "0 * * * *",
      1800,
    ),
  );

  // 🟡 MEDIUM JOBS (1 hour)
  tasks.push(
    scheduleCronJob("device_cleanup", deviceCleanupJob.run, "0 * * * *", 900),
  );

  tasks.push(scheduleCronJob("reminder", reminderJob.run, "0 * * * *", 900));

  // 🔵 FAST JOBS (10 min)
  tasks.push(
    scheduleCronJob("escalation", escalationJob.run, "*/10 * * * *", 600),
  );

  tasks.push(
    scheduleCronJob("retry", notificationRetryJob.run, "*/10 * * * *", 600),
  );

  tasks.push(
    scheduleCronJob("compliance", complianceJob.run, "*/10 * * * *", 600),
  );

  // 🟢 VERY FREQUENT (5 min)
  tasks.push(
    scheduleCronJob("api_metrics", apiMetricsJob.run, "*/5 * * * *", 300),
  );

  tasks.push(
    scheduleCronJob("dead_job_monitor", deadJobMonitor.run, "*/5 * * * *", 300),
  );

  /*
  |--------------------------------------------------------------------------
  | Graceful Shutdown (UNCHANGED)
  |--------------------------------------------------------------------------
  */

  gracefulShutdown(tasks);
}

module.exports = {
  startJobs,
  jobRegistry,
};
