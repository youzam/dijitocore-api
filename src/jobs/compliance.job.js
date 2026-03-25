const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");

const deletionService = require("../services/deletion.service");
const exportService = require("../services/export.service");

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS PURGE QUEUE
|--------------------------------------------------------------------------
*/

const processPurgeQueue = async () => {
  const jobs = await prisma.purgeQueue.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: 3 },
    },
  });

  for (const job of jobs) {
    try {
      // 🔒 LOCK JOB
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
        },
      });

      const request = job.dataRequestId
        ? await prisma.dataRequest.findUnique({
            where: { id: job.dataRequestId },
          })
        : null;

      // ✅ EXECUTE DELETION ENGINE
      if (job.dataRequestId) {
        await deletionService.executeDeletion(job.dataRequestId);
      } else {
        await deletionService.executeDeletionByTarget(
          job.targetType,
          job.targetId,
        );
      }

      // ✅ MARK JOB COMPLETE ONLY
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // ❌ DO NOT update dataRequest here (handled in service)

      if (request) {
        await sendWebhook("PURGE_COMPLETED", request);
      }

      // 🧾 AUDIT
      await auditHelper.logAudit({
        userId: request?.approvedById || null,
        entityType: "PURGE_JOB",
        entityId: job.id,
        action: "PURGE_EXECUTED",
        metadata: {
          dataRequestId: job.dataRequestId,
          targetType: job.targetType,
          targetId: job.targetId,
        },
        module: "COMPLIANCE",
        actorType: "SYSTEM",
      });
    } catch (error) {
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: error.message,
          attempts: { increment: 1 },
        },
      });

      await auditHelper.logAudit({
        userId: null,
        entityType: "PURGE_JOB",
        entityId: job.id,
        action: "PURGE_FAILED",
        metadata: {
          error: error.message,
        },
        module: "COMPLIANCE",
        actorType: "SYSTEM",
      });
    }
  }
};

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS EXPORT REQUESTS
|--------------------------------------------------------------------------
*/

const processExportRequests = async () => {
  const requests = await prisma.dataRequest.findMany({
    where: {
      type: "EXPORT",
      status: "APPROVED",
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const req of requests) {
    try {
      // 🔒 LOCK REQUEST
      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          status: "PROCESSING",
        },
      });

      // ✅ EXPORT ENGINE (handles S3 + DB internally)
      await exportService.generateExport(req.id);

      await sendWebhook("EXPORT_COMPLETED", req);
    } catch (error) {
      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          status: "FAILED",
        },
      });

      await auditHelper.logAudit({
        userId: null,
        entityType: "DATA_REQUEST",
        entityId: req.id,
        action: "EXPORT_FAILED",
        metadata: { error: error.message },
        module: "COMPLIANCE",
        actorType: "SYSTEM",
      });
    }
  }
};

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS RETENTION POLICIES
|--------------------------------------------------------------------------
*/

const processRetentionPolicies = async () => {
  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { isActive: true },
  });

  for (const policy of policies) {
    const cutoffDate = new Date(
      Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000,
    );

    if (policy.resource === "USER") {
      const users = await prisma.user.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          isDeleted: false,
        },
      });

      for (const user of users) {
        await prisma.purgeQueue.create({
          data: {
            targetType: "USER",
            targetId: user.id,
            status: "PENDING",
            attempts: 0,
          },
        });
      }
    }
  }
};

/*
|--------------------------------------------------------------------------
| INTERNAL: WEBHOOK HANDLER
|--------------------------------------------------------------------------
*/

const sendWebhook = async (event, payload) => {
  console.log(`[WEBHOOK] ${event}`, payload.id);
};

/*
|--------------------------------------------------------------------------
| MAIN JOB ENTRY
|--------------------------------------------------------------------------
*/

module.exports = {
  run: async () => {
    await processRetentionPolicies();
    await processPurgeQueue();
    await processExportRequests();
  },
};
