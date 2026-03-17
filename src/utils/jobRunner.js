const prisma = require("../config/prisma");
const systemJobService = require("../modules/admin/operation/operation.service");

const instanceId = process.env.INSTANCE_ID || `instance-${process.pid}`;

const activeJobs = new Map();

/*
|--------------------------------------------------------------------------
| HARDENING CONFIG (ADDED)
|--------------------------------------------------------------------------
*/

const MAX_RETRIES = 3;
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;

const jobRetries = new Map();

/*
|--------------------------------------------------------------------------
| PER-JOB CONFIG (ADDED)
|--------------------------------------------------------------------------
*/

const JOB_CONFIG = {
  dashboard_snapshot: { timeout: 10 * 60 * 1000 },
  subscription_lifecycle: { timeout: 10 * 60 * 1000 },

  device_cleanup: { timeout: 5 * 60 * 1000 },
  reminder: { timeout: 5 * 60 * 1000 },

  escalation: { timeout: 2 * 60 * 1000 },
  retry: { timeout: 2 * 60 * 1000 },
  compliance: { timeout: 2 * 60 * 1000 },

  api_metrics: { timeout: 60 * 1000 },
};

/*
|--------------------------------------------------------------------------
| LOCK MANAGEMENT (UNCHANGED CORE)
|--------------------------------------------------------------------------
*/

async function acquireLock(jobName, ttlSeconds) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + ttlSeconds * 1000);

  try {
    const result = await prisma.jobLock.updateMany({
      where: {
        jobName,
        OR: [{ lockedUntil: { lt: now } }, { instanceId }],
      },
      data: {
        lockedAt: now,
        lockedUntil: lockUntil,
        instanceId,
      },
    });

    if (result.count === 0) {
      try {
        await prisma.jobLock.create({
          data: {
            jobName,
            lockedAt: now,
            lockedUntil: lockUntil,
            instanceId,
          },
        });
        return true;
      } catch {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function releaseLock(jobName) {
  try {
    await prisma.jobLock.updateMany({
      where: {
        jobName,
        instanceId,
      },
      data: {
        lockedUntil: new Date(),
      },
    });
  } catch (err) {
    console.error("Failed to release lock:", jobName, err);
  }
}

/*
|--------------------------------------------------------------------------
| SAFE JOB RUNNER (FULL HARDENED)
|--------------------------------------------------------------------------
*/

async function runSafeJob(jobName, jobFn, ttlSeconds = 900) {
  if (activeJobs.get(jobName)) return;

  const lock = await acquireLock(jobName, ttlSeconds);
  if (!lock) return;

  activeJobs.set(jobName, true);

  const startedAt = new Date();
  let heartbeat;

  try {
    /*
    |--------------------------------------------------------------------------
    | HEARTBEAT (EXTEND LOCK)
    |--------------------------------------------------------------------------
    */
    heartbeat = setInterval(async () => {
      try {
        await prisma.jobLock.updateMany({
          where: { jobName, instanceId },
          data: {
            lockedUntil: new Date(Date.now() + ttlSeconds * 1000),
          },
        });
      } catch (err) {
        console.error("Heartbeat failed:", jobName, err);
      }
    }, 30000);

    /*
    |--------------------------------------------------------------------------
    | LOG START
    |--------------------------------------------------------------------------
    */
    await systemJobService.logJobExecution({
      jobName,
      status: "RUNNING",
      startedAt,
    });

    /*
    |--------------------------------------------------------------------------
    | TIMEOUT (PER-JOB)
    |--------------------------------------------------------------------------
    */
    const timeout = JOB_CONFIG[jobName]?.timeout || DEFAULT_JOB_TIMEOUT_MS;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Job timeout exceeded"));
      }, timeout);
    });

    await Promise.race([jobFn(), timeoutPromise]);

    /*
    |--------------------------------------------------------------------------
    | RESET RETRIES
    |--------------------------------------------------------------------------
    */
    jobRetries.delete(jobName);

    /*
    |--------------------------------------------------------------------------
    | LOG SUCCESS
    |--------------------------------------------------------------------------
    */
    await systemJobService.logJobExecution({
      jobName,
      status: "SUCCESS",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (err) {
    /*
    |--------------------------------------------------------------------------
    | RETRY TRACKING (MEMORY)
    |--------------------------------------------------------------------------
    */
    const retries = (jobRetries.get(jobName) || 0) + 1;
    jobRetries.set(jobName, retries);

    /*
    |--------------------------------------------------------------------------
    | PERSIST RETRIES (DB)
    |--------------------------------------------------------------------------
    */
    await prisma.systemJobLog.updateMany({
      where: { jobName },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });

    /*
    |--------------------------------------------------------------------------
    | LOG FAILURE
    |--------------------------------------------------------------------------
    */
    await systemJobService.logJobExecution({
      jobName,
      status: "FAILED",
      startedAt,
      finishedAt: new Date(),
      errorMessage: err.message,
    });

    /*
    |--------------------------------------------------------------------------
    | RETRY + BACKOFF
    |--------------------------------------------------------------------------
    */
    if (retries <= MAX_RETRIES) {
      const backoff = retries * 10000;

      console.warn(
        `Retrying job ${jobName} (${retries}/${MAX_RETRIES}) in ${backoff}ms`,
      );

      setTimeout(() => {
        runSafeJob(jobName, jobFn, ttlSeconds);
      }, backoff);
    } else {
      console.error(`Job ${jobName} exceeded max retries`);
      jobRetries.delete(jobName);

      /*
      |--------------------------------------------------------------------------
      | DEAD JOB TRACKING
      |--------------------------------------------------------------------------
      */
      await prisma.deadJob.create({
        data: {
          jobName,
          instanceId,
          reason: "Max retries exceeded",
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ALERT WEBHOOK
    |--------------------------------------------------------------------------
    */
    if (process.env.JOB_ALERT_WEBHOOK) {
      try {
        await fetch(process.env.JOB_ALERT_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job: jobName,
            error: err.message,
            retries,
            instance: instanceId,
          }),
        });
      } catch (_) {}
    }

    throw err;
  } finally {
    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */
    if (heartbeat) clearInterval(heartbeat);

    activeJobs.delete(jobName);
    await releaseLock(jobName);
  }
}

/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN (CRON SAFE)
|--------------------------------------------------------------------------
*/

let shutdownHookRegistered = false;

function gracefulShutdown(tasks) {
  if (shutdownHookRegistered) return;
  shutdownHookRegistered = true;

  const shutdown = async () => {
    console.log("🛑 Shutting down jobs...");

    for (const task of tasks) {
      try {
        if (task && typeof task.stop === "function") {
          task.stop();
        }
      } catch (err) {
        console.error("Failed to stop task:", err);
      }
    }

    while (activeJobs.size > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }

    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = {
  runSafeJob,
  gracefulShutdown,
};
