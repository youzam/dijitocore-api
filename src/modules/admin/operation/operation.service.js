const fs = require("fs");
const path = require("path");
const os = require("os");

const prisma = require("../../../config/prisma");
const { logAudit } = require("../../../utils/audit.helper");
const env = require("../../../config/env");

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

  const storagePath = env.storage.path || path.join(process.cwd(), "uploads");

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

  await logAudit({
    entityType: "SYSTEM_JOB",
    entityId: jobId,
    action: "JOB_RETRIED",
    metadata: {
      jobName: job.jobName,
      previousStatus: "FAILED",
      newStatus: "SUCCESS",
      retryCount: job.retryCount + 1,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return { success: true };
};

exports.storeApiMetricsSnapshot = async () => {
  const metrics = global.apiMetrics || {};

  const result = await prisma.apiMetric.create({
    data: {
      totalRequests: metrics.totalRequests || 0,
      successRequests: metrics.successRequests || 0,
      failedRequests: metrics.failedRequests || 0,
      avgResponseTime: metrics.avgResponseTime || 0,
    },
  });

  await logAudit({
    entityType: "API_METRIC",
    entityId: result.id,
    action: "API_METRIC_SNAPSHOT_CREATED",
    metadata: {
      totalRequests: result.totalRequests,
      successRequests: result.successRequests,
      failedRequests: result.failedRequests,
      avgResponseTime: result.avgResponseTime,
    },
    actorType: "SYSTEM",
    module: "OPERATION",
  });

  return result;
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

exports.setMaintenanceMode = async (enabled) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.MAINTENANCE_MODE = enabled;

  const result = await updateSystemSetting({ featureFlags });

  await logAudit({
    entityType: "SYSTEM_SETTING",
    entityId: 1,
    action: enabled ? "MAINTENANCE_MODE_ENABLED" : "MAINTENANCE_MODE_DISABLED",
    metadata: {
      MAINTENANCE_MODE: enabled,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return result;
};

exports.setEmergencyShutdown = async (enabled) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.EMERGENCY_SHUTDOWN = enabled;

  // enforce system behavior ONLY when enabling
  if (enabled) {
    featureFlags.API_WRITE_ENABLED = false;
    featureFlags.PAYMENT_ENABLED = false;
    featureFlags.AUTH_ENABLED = false;
  } else {
    // restore defaults
    featureFlags.API_WRITE_ENABLED = true;
    featureFlags.PAYMENT_ENABLED = true;
    featureFlags.AUTH_ENABLED = true;
  }

  const result = await updateSystemSetting({ featureFlags });

  await logAudit({
    entityType: "SYSTEM_SETTING",
    entityId: 1,
    action: enabled
      ? "EMERGENCY_SHUTDOWN_TRIGGERED"
      : "EMERGENCY_SHUTDOWN_LIFTED",
    metadata: {
      EMERGENCY_SHUTDOWN: enabled,
      API_WRITE_ENABLED: featureFlags.API_WRITE_ENABLED,
      PAYMENT_ENABLED: featureFlags.PAYMENT_ENABLED,
      AUTH_ENABLED: featureFlags.AUTH_ENABLED,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return result;
};

exports.setPaymentEnabled = async (enabled) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.PAYMENT_ENABLED = enabled;

  const result = await updateSystemSetting({ featureFlags });

  await logAudit({
    entityType: "SYSTEM_SETTING",
    entityId: 1,
    action: enabled ? "PAYMENT_ENABLED" : "PAYMENT_DISABLED",
    metadata: {
      PAYMENT_ENABLED: enabled,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return result;
};

exports.setApiWriteEnabled = async (enabled) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.API_WRITE_ENABLED = enabled;

  const result = await updateSystemSetting({ featureFlags });

  await logAudit({
    entityType: "SYSTEM_SETTING",
    entityId: 1,
    action: enabled ? "API_WRITE_ENABLED" : "API_WRITE_DISABLED",
    metadata: {
      API_WRITE_ENABLED: enabled,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return result;
};

exports.setAuthEnabled = async (enabled) => {
  const setting = await getSystemSetting();

  const featureFlags = setting.featureFlags || {};

  featureFlags.AUTH_ENABLED = enabled;

  const result = await updateSystemSetting({ featureFlags });

  await logAudit({
    entityType: "SYSTEM_SETTING",
    entityId: 1,
    action: enabled ? "AUTH_ENABLED" : "AUTH_DISABLED",
    metadata: {
      AUTH_ENABLED: enabled,
    },
    actorType: "ADMIN",
    module: "OPERATION",
  });

  return result;
};
/*
|--------------------------------------------------------------------------
| Existing (KEEP - DO NOT BREAK)
|--------------------------------------------------------------------------
*/

exports.logJobExecution = async (data) => {
  const result = await prisma.systemJobLog.create({
    data,
  });

  await logAudit({
    entityType: "SYSTEM_JOB",
    entityId: result.id,
    action: "JOB_EXECUTION_LOGGED",
    metadata: {
      jobName: data.jobName,
      status: data.status,
    },
    actorType: "SYSTEM",
    module: "OPERATION",
  });

  return result;
};

/*
|--------------------------------------------------------------------------
| DASHBOARD OVERVIEW
|--------------------------------------------------------------------------
*/

exports.getOperationsOverview = async () => {
  const total = await prisma.systemJobLog.count();

  const success = await prisma.systemJobLog.count({
    where: { status: "SUCCESS" },
  });

  const failed = await prisma.systemJobLog.count({
    where: { status: "FAILED" },
  });

  const running = await prisma.systemJobLog.count({
    where: { status: "RUNNING" },
  });

  const deadJobs = await prisma.deadJob.count();

  return {
    total,
    success,
    failed,
    running,
    deadJobs,
  };
};

/*
|--------------------------------------------------------------------------
| JOB PERFORMANCE
|--------------------------------------------------------------------------
*/

exports.getJobPerformance = async () => {
  const jobs = await prisma.systemJobLog.groupBy({
    by: ["jobName"],
    _count: true,
    _avg: {
      retryCount: true,
    },
  });

  return jobs;
};
