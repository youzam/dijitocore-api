const prisma = require("../config/prisma");

async function run() {
  const stuckJobs = await prisma.jobLock.findMany({
    where: {
      lockedUntil: {
        lt: new Date(),
      },
    },
  });

  for (const job of stuckJobs) {
    await prisma.deadJob.create({
      data: {
        jobName: job.jobName,
        instanceId: job.instanceId,
        reason: "Lock expired (possible crash)",
      },
    });
  }
}

module.exports = { run };
