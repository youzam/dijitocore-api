const prisma = require("../../../config/prisma");
const fs = require("fs");
const path = require("path");
const os = require("os");

let storageCache = {
  value: null,
  lastUpdated: null,
};

const CACHE_TTL = 1000 * 60 * 3; // 3 minutes

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getSystemSetting = async () => {
  const setting = await prisma.systemSetting.findFirst();
  return setting || {};
};

const updateSystemSetting = async (data) => {
  return prisma.systemSetting.update({
    where: { id: 1 },
    data,
  });
};

const calculateDirectorySize = (dirPath) => {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      totalSize += calculateDirectorySize(fullPath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
};

/*
|--------------------------------------------------------------------------
| System Health
|--------------------------------------------------------------------------
*/

exports.getSystemHealth = async () => {
  const start = Date.now();

  let dbStatus = "OK";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "DOWN";
  }

  const lastJob = await prisma.systemJobLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const failedJobs = await prisma.systemJobLog.count({
    where: { status: "FAILED" },
  });

  const totalJobs = await prisma.systemJobLog.count();

  const errorRate =
    totalJobs === 0 ? 0 : ((failedJobs / totalJobs) * 100).toFixed(2);

  return {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuLoad: os.loadavg(),
    dbStatus,
    lastJob,
    failedJobs,
    totalJobs,
    errorRate,
    responseTime: Date.now() - start,
  };
};

/*
|--------------------------------------------------------------------------
| DB Usage
|--------------------------------------------------------------------------
*/

exports.getDbUsage = async () => {
  const result =
    await prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`;

  return {
    size: Number(result[0].size),
  };
};

/*
|--------------------------------------------------------------------------
| Storage Usage (Cached)
|--------------------------------------------------------------------------
*/

exports.getStorageUsage = async () => {
  const now = Date.now();

  if (
    storageCache.value &&
    storageCache.lastUpdated &&
    now - storageCache.lastUpdated < CACHE_TTL
  ) {
    return storageCache.value;
  }

  const storagePath =
    process.env.STORAGE_PATH || path.join(process.cwd(), "uploads");

  const size = calculateDirectorySize(storagePath);

  const result = { size, path: storagePath };

  storageCache = {
    value: result,
    lastUpdated: now,
  };

  return result;
};

/*
|--------------------------------------------------------------------------
| API Metrics (from middleware memory if exists)
|--------------------------------------------------------------------------
*/

exports.getApiMetrics = async () => {
  const latest = await prisma.apiMetric.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const live = global.apiMetrics || {};

  return {
    live: {
      totalRequests: live.totalRequests || 0,
      successRequests: live.successRequests || 0,
      failedRequests: live.failedRequests || 0,
      avgResponseTime: live.avgResponseTime || 0,
    },
    lastSnapshot: latest || null,
  };
};

/*
|--------------------------------------------------------------------------
| Job Monitoring
|--------------------------------------------------------------------------
*/

exports.getJobLogs = async (query) => {
  const { status, limit = 50 } = query;

  return prisma.systemJobLog.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: Number(limit),
  });
};

exports.retryFailedJob = async (jobId) => {
  const job = await prisma.systemJobLog.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error("operations.job_not_found");

  if (job.status !== "FAILED") {
    throw new Error("operations.job_not_retryable");
  }

  const jobs = require("../../../jobs");

  if (!jobs[job.jobName]) {
    throw new Error("operations.job_handler_missing");
  }

  // Execute job
  await jobs[job.jobName]();

  // Update retry tracking
  await prisma.systemJobLog.update({
    where: { id: jobId },
    data: {
      retryCount: { increment: 1 },
      lastRetriedAt: new Date(),
      status: "SUCCESS",
    },
  });

  return { success: true };
};

exports.storeApiMetricsSnapshot = async () => {
  const metrics = global.apiMetrics || {};

  return prisma.apiMetric.create({
    data: {
      totalRequests: metrics.totalRequests || 0,
      successRequests: metrics.successRequests || 0,
      failedRequests: metrics.failedRequests || 0,
      avgResponseTime: metrics.avgResponseTime || 0,
    },
  });
};

/*
|--------------------------------------------------------------------------
| Webhook Monitoring
|--------------------------------------------------------------------------
*/

exports.getWebhookStats = async () => {
  const total = await prisma.transaction.count();

  const failed = await prisma.transaction.count({
    where: { webhookStatus: "FAILED" },
  });

  return {
    total,
    failed,
    success: total - failed,
  };
};

/*
|--------------------------------------------------------------------------
| Gateway Monitoring
|--------------------------------------------------------------------------
*/

exports.getGatewayStats = async () => {
  const grouped = await prisma.transaction.groupBy({
    by: ["gateway"],
    _count: true,
  });

  return grouped;
};

/*
|--------------------------------------------------------------------------
| Maintenance Mode
|--------------------------------------------------------------------------
*/

exports.enableMaintenance = async () => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.MAINTENANCE_MODE = true;

  return updateSystemSetting({ featureFlags });
};

exports.disableMaintenance = async () => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.MAINTENANCE_MODE = false;

  return updateSystemSetting({ featureFlags });
};

/*
|--------------------------------------------------------------------------
| Feature Flags
|--------------------------------------------------------------------------
*/

exports.toggleFeatureFlag = async (flag) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags[flag] = !featureFlags[flag];

  return updateSystemSetting({ featureFlags });
};

/*
|--------------------------------------------------------------------------
| Emergency Shutdown
|--------------------------------------------------------------------------
*/

exports.emergencyShutdown = async () => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.API_WRITE_ENABLED = false;
  featureFlags.PAYMENTS_ENABLED = false;
  featureFlags.JOB_PROCESSING_ENABLED = false;

  return updateSystemSetting({ featureFlags });
};

/*
|--------------------------------------------------------------------------
| Existing (KEEP - DO NOT BREAK)
|--------------------------------------------------------------------------
*/

exports.logJobExecution = async (data) => {
  return prisma.systemJobLog.create({
    data,
  });
};
