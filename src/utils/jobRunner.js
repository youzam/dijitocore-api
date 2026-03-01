const prisma = require("../config/prisma");
const systemJobService = require("../modules/system/system.job.service");

const instanceId = process.env.INSTANCE_ID || `instance-${process.pid}`;

const activeJobs = new Map();

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
      // Try create if doesn't exist
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

async function runSafeJob(jobName, jobFn, ttlSeconds = 900) {
  if (activeJobs.get(jobName)) return;

  const lock = await acquireLock(jobName, ttlSeconds);
  if (!lock) return;

  activeJobs.set(jobName, true);

  const startedAt = new Date();
  let heartbeat;

  try {
    heartbeat = setInterval(async () => {
      try {
        await prisma.jobLock.updateMany({
          where: {
            jobName,
            instanceId,
          },
          data: {
            lockedUntil: new Date(Date.now() + ttlSeconds * 1000),
          },
        });
      } catch (err) {
        console.error("Heartbeat failed:", jobName, err);
      }
    }, 30000);

    await systemJobService.logJobExecution({
      jobName,
      status: "running",
      startedAt,
    });

    await jobFn();

    await systemJobService.logJobExecution({
      jobName,
      status: "success",
      startedAt,
      finishedAt: new Date(),
    });
  } catch (err) {
    await systemJobService.logJobExecution({
      jobName,
      status: "failed",
      startedAt,
      finishedAt: new Date(),
      errorMessage: err.message,
    });

    if (process.env.JOB_ALERT_WEBHOOK) {
      try {
        await fetch(process.env.JOB_ALERT_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job: jobName,
            error: err.message,
            instance: instanceId,
          }),
        });
      } catch (_) {}
    }

    throw err;
  } finally {
    if (heartbeat) clearInterval(heartbeat);

    activeJobs.delete(jobName);
    await releaseLock(jobName);
  }
}

let shutdownHookRegistered = false;

function gracefulShutdown(intervals) {
  if (shutdownHookRegistered) return;
  shutdownHookRegistered = true;

  const shutdown = async () => {
    console.log("🛑 Shutting down jobs...");

    for (const interval of intervals) {
      clearInterval(interval);
    }

    // Wait for active jobs
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
