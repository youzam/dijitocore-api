const prisma = require('../config/prisma');
const auditHelper = require('../utils/audit.helper');

const { executeFullDeletion } = require('../services/deletion.service');
const { executeExport } = require('../services/export.service');

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS PURGE QUEUE
|--------------------------------------------------------------------------
*/

const processPurgeQueue = async () => {
  const jobs = await prisma.purgeQueue.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: 3 },
    },
  });

  for (const job of jobs) {
    try {
      // 🔒 ATOMIC LOCK
      const lock = await prisma.purgeQueue.updateMany({
        where: {
          id: job.id,
          status: 'PENDING',
        },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      if (lock.count === 0) continue;

      const request = job.dataRequestId
        ? await prisma.dataRequest.findUnique({
            where: { id: job.dataRequestId },
          })
        : null;

      // 🛑 IDEMPOTENCY GUARD
      if (request?.processedAt) {
        continue; // already processed
      }

      // 🔴 APPROVAL CHECK
      if (request?.type === 'DELETE' && !request.approvedAt) {
        throw new Error('Deletion request not approved');
      }

      // 🔥 DELETE FLOW (NEW ENGINE)
      if (request?.type === 'DELETE') {
        await executeFullDeletion({
          rootModel: request.targetType,
          rootId: request.targetId,
        });

        await prisma.dataRequest.update({
          where: { id: request.id },
          data: {
            processedAt: new Date(),
          },
        });
      }

      // 🔥 EXPORT FLOW (FINAL CLEAN)
      if (request?.type === 'EXPORT') {
        // 🛑 Already processed / exported
        if (request.processedAt || request.exportFilePath) {
          continue;
        }

        // 🔴 Approval required
        if (!request.approvedAt) {
          throw new Error('Export request not approved');
        }

        const exportResult = await executeExport({
          rootModel: request.targetType,
          rootId: request.targetId,
        });

        await prisma.dataRequest.update({
          where: { id: request.id },
          data: {
            exportFilePath: exportResult.s3Key,
            processedAt: new Date(),
          },
        });
      }

      // 🔁 FALLBACK (legacy support)
      if (!request && job.targetType && job.targetId) {
        await executeFullDeletion({
          rootModel: job.targetType.toLowerCase(),
          rootId: job.targetId,
        });
      }

      // ✅ MARK COMPLETE
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      if (request) {
        await sendWebhook(`${request.type}_COMPLETED`, request);
      }

      // 🧾 AUDIT
      await auditHelper.logAudit({
        userId: request?.approvedById || null,
        entityType: 'PURGE_JOB',
        entityId: job.id,
        action: 'PURGE_EXECUTED',
        metadata: {
          dataRequestId: job.dataRequestId,
          targetType: job.targetType,
          targetId: job.targetId,
        },
        module: 'COMPLIANCE',
        actorType: 'ADMIN',
      });
    } catch (error)  {
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: error.message,
          attempts: { increment: 1 },
        },
      });

      await auditHelper.logAudit({
        userId: null,
        entityType: 'PURGE_JOB',
        entityId: job.id,
        action: 'PURGE_FAILED',
        metadata: {
          error: error.message,
        },
        module: 'COMPLIANCE',
        actorType: 'ADMIN',
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
      type: 'EXPORT',
      status: 'APPROVED',
      attempts: { lt: 3 },
    },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  for (const req of requests) {
    try {
      // 🔒 ATOMIC LOCK
      const lock = await prisma.dataRequest.updateMany({
        where: {
          id: req.id,
          status: 'APPROVED',
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (lock.count === 0) continue;

      // 🔥 NEW EXPORT ENGINE
      const exportResult = await executeExport({
        rootModel: req.targetType,
        rootId: req.targetId,
      });

      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          exportFilePath: exportResult.files.zipPath,
          processedAt: new Date(),
        },
      });

      await auditHelper.logAudit({
        userId: req.requestedByUserId || req.requestedByAdminId || null,
        entityType: 'DATA_REQUEST',
        entityId: req.id,
        action: 'EXPORT_COMPLETED',
        metadata: {
          requestId: req.id,
          targetType: req.targetType,
          targetId: req.targetId,
          reason: req.reason || null,
        },
        module: 'COMPLIANCE',
      });

      await sendWebhook('EXPORT_COMPLETED', req);
    } catch (error)  {
      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          lastError: error.message,
        },
      });

      await auditHelper.logAudit({
        userId: null,
        entityType: 'DATA_REQUEST',
        entityId: req.id,
        action: 'EXPORT_FAILED',
        metadata: {
          requestId: req.id,
          error: error.message,
        },
        module: 'COMPLIANCE',
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

    if (policy.resource === 'USER') {
      const users = await prisma.user.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          isDeleted: false,
        },
      });

      for (const user of users) {
        const exists = await prisma.purgeQueue.findFirst({
          where: {
            targetType: 'USER',
            targetId: user.id,
            status: { in: ['PENDING', 'PROCESSING'] },
          },
        });

        if (!exists) {
          await prisma.purgeQueue.create({
            data: {
              targetType: 'USER',
              targetId: user.id,
              status: 'PENDING',
              attempts: 0,
            },
          });
        }
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
