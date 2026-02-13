const prisma = require("../../config/prisma");

exports.getSystemHealth = async () => {
  // 1. Database connectivity test
  let dbStatus = "healthy";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "unhealthy";
  }

  // 2. Last job execution
  const lastJob = await prisma.systemJobLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  // 3. Failed jobs count (last 24 hours)
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedJobsCount = await prisma.systemJobLog.count({
    where: {
      status: "failed",
      createdAt: { gte: last24Hours },
    },
  });

  // 4. Error rate (last 24 hours)
  const totalJobs = await prisma.systemJobLog.count({
    where: {
      createdAt: { gte: last24Hours },
    },
  });

  const errorRate = totalJobs === 0 ? 0 : (failedJobsCount / totalJobs) * 100;

  return {
    dbStatus,
    lastJobRunAt: lastJob ? lastJob.createdAt : null,
    failedJobsCount,
    errorRate,
  };
};
