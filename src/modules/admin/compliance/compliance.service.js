const prisma = require('../../../config/prisma');
const { logAudit } = require('../../../utils/audit.helper');

/*
|--------------------------------------------------------------------------
| INTERNAL HELPERS
|--------------------------------------------------------------------------
*/

const createPolicyVersion = async (tx, policy, adminId) => {
  return tx.policyVersion.create({
    data: {
      policyId: policy.id,
      resource: policy.resource,
      retentionDays: policy.retentionDays,
      version: policy.version,
      createdById: adminId,
    },
  });
};

/*
|--------------------------------------------------------------------------
| DATA RETENTION POLICY
|--------------------------------------------------------------------------
*/

exports.createRetentionPolicy = async (data, adminId) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dataRetentionPolicy.findFirst({
      where: { resource: data.resource, isActive: true },
    });

    if (existing) {
      throw new Error('Active policy already exists');
    }

    const policy = await tx.dataRetentionPolicy.create({
      data: {
        resource: data.resource,
        retentionDays: data.retentionDays,
        createdById: adminId,
      },
    });

    await createPolicyVersion(tx, policy, adminId);

    await logAudit({
      tx,
      userId: adminId,
      entityType: 'RETENTION_POLICY',
      entityId: policy.id,
      action: 'RETENTION_POLICY_CREATED',
      metadata: {
        resource: policy.resource,
        retentionDays: policy.retentionDays,
      },
      module: 'COMPLIANCE',
      actorType: 'ADMIN',
    });

    return policy;
  });
};

exports.updateRetentionPolicy = async (policyId, data, adminId) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dataRetentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!existing) {
      throw new Error('Policy not found');
    }

    const updated = await tx.dataRetentionPolicy.update({
      where: { id: policyId },
      data: {
        retentionDays: data.retentionDays,
        version: existing.version + 1,
      },
    });

    await createPolicyVersion(tx, updated, adminId);

    await logAudit({
      tx,
      userId: adminId,
      entityType: 'RETENTION_POLICY',
      entityId: policyId,
      action: 'RETENTION_POLICY_UPDATED',
      metadata: {
        retentionDays: data.retentionDays,
      },
      module: 'COMPLIANCE',
      actorType: 'ADMIN',
    });

    return updated;
  });
};

exports.getRetentionPolicyByResource = async (resource) => {
  return prisma.dataRetentionPolicy.findFirst({
    where: {
      resource,
      isActive: true,
    },
  });
};

exports.toggleRetentionPolicy = async (policyId, isActive, adminId) => {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.dataRetentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    if (isActive) {
      const existing = await tx.dataRetentionPolicy.findFirst({
        where: {
          resource: policy.resource,
          isActive: true,
          id: { not: policyId },
        },
      });

      if (existing) {
        throw new Error('Another active policy exists for this resource');
      }
    }

    const updated = await tx.dataRetentionPolicy.update({
      where: { id: policyId },
      data: { isActive },
    });

    await logAudit({
      userId: adminId,
      entityType: 'RETENTION_POLICY',
      entityId: policyId,
      action: isActive ? 'POLICY_ACTIVATED' : 'POLICY_DEACTIVATED',
      module: 'COMPLIANCE',
      actorType: 'ADMIN',
    });

    return updated;
  });
};

exports.getPolicyVersionById = async (versionId) => {
  return prisma.policyVersion.findUnique({
    where: { id: versionId },
  });
};

/*
|--------------------------------------------------------------------------
| DATA REQUESTS (EXPORT + DELETE)
|--------------------------------------------------------------------------
*/

exports.listDataRequests = async (query, adminUser) => {
  if (!adminUser || !adminUser.role) {
    throw new Error('Unauthorized');
  }

  const { type, status, page = 1, limit = 20 } = query;

  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (parseInt(page, 10) - 1) * take;

  return prisma.dataRequest.findMany({
    where: {
      ...(type && { type }),
      ...(status && { status }),
    },
    include: {
      requestedByUser: true,
      requestedByCustomer: true,
      requestedByAdmin: true,
      approvedBy: true,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
};

exports.getDataRequestById = async (requestId) => {
  return prisma.dataRequest.findUnique({
    where: { id: requestId },
  });
};

exports.approveDataRequest = async (requestId, adminId) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.dataRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Already processed');
    }

    const updated = await tx.dataRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    // DELETE FLOW
    if (request.type === 'DELETE') {
      await tx.purgeQueue.create({
        data: {
          dataRequestId: request.id,
          status: 'PENDING',
          attempts: 0,
        },
      });
    }

    // EXPORT FLOW
    if (request.type === 'EXPORT') {
      await tx.dataRequest.update({
        where: { id: request.id },
        data: {
          status: 'PROCESSING',
        },
      });
    }

    // ✅ AUDIT LOG (IMPORTANT FIX)
    await logAudit({
      userId: adminId,
      entityType: 'DATA_REQUEST',
      entityId: request.id,
      action: 'DATA_REQUEST_APPROVED',
      metadata: {
        requestType: request.type,
        targetType: request.targetType,
        targetId: request.targetId,
      },
      module: 'COMPLIANCE',
      actorType: 'ADMIN',
    });

    return updated;
  });
};

exports.rejectDataRequest = async (requestId, adminId) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Already processed');
  }

  const updated = await prisma.dataRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      approvedById: adminId,
      approvedAt: new Date(),
    },
  });

  await logAudit({
    userId: adminId,
    entityType: 'DATA_REQUEST',
    entityId: requestId,
    action: 'DATA_REQUEST_REJECTED',
    module: 'COMPLIANCE',
    actorType: 'ADMIN',
  });

  return updated;
};

exports.getPurgeQueueItem = async (queueId) => {
  return prisma.purgeQueue.findUnique({
    where: { id: queueId },
  });
};

exports.retryPurgeJob = async (queueId, adminId) => {
  const job = await prisma.purgeQueue.findUnique({
    where: { id: queueId },
  });

  if (!job) {
    throw new Error('Purge job not found');
  }

  if (job.attempts >= 3) {
    throw new Error('Max retry limit reached');
  }

  if (job.status !== 'FAILED') {
    throw new Error('Only failed jobs can be retried');
  }

  const updated = await prisma.purgeQueue.update({
    where: { id: queueId },
    data: {
      status: 'PENDING',
      attempts: { increment: 1 },
    },
  });

  // ✅ AUDIT LOG
  await logAudit({
    userId: adminId,
    entityType: 'PURGE_JOB',
    entityId: queueId,
    action: 'PURGE_RETRY',
    metadata: {
      attempts: updated.attempts,
    },
    module: 'COMPLIANCE',
    actorType: 'ADMIN',
  });

  return updated;
};

exports.getConsentLogById = async (logId) => {
  return prisma.consentLog.findUnique({
    where: { id: logId },
  });
};
