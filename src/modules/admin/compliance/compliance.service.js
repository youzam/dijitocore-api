const prisma = require("../../config/prisma");

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

const createPurgeQueue = async (tx, dataRequestId) => {
  return tx.purgeQueue.create({
    data: {
      dataRequestId,
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
      throw new Error("Active policy already exists");
    }

    const policy = await tx.dataRetentionPolicy.create({
      data: {
        resource: data.resource,
        retentionDays: data.retentionDays,
        createdById: adminId,
      },
    });

    await createPolicyVersion(tx, policy, adminId);

    await tx.auditLog.create({
      data: {
        action: "CREATE_RETENTION_POLICY",
        entity: "DataRetentionPolicy",
        entityId: policy.id,
        performedById: adminId,
      },
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
      throw new Error("Policy not found");
    }

    const updated = await tx.dataRetentionPolicy.update({
      where: { id: policyId },
      data: {
        retentionDays: data.retentionDays,
        version: existing.version + 1,
      },
    });

    await createPolicyVersion(tx, updated, adminId);

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

exports.listRetentionPolicies = async (query) => {
  const { resource, isActive } = query;

  return prisma.dataRetentionPolicy.findMany({
    where: {
      ...(resource && { resource }),
      ...(isActive !== undefined && { isActive }),
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.toggleRetentionPolicy = async (policyId, isActive, adminId) => {
  return prisma.dataRetentionPolicy.update({
    where: { id: policyId },
    data: { isActive },
  });
};

/*
|--------------------------------------------------------------------------
| POLICY VERSION
|--------------------------------------------------------------------------
*/

exports.listPolicyVersions = async (policyId) => {
  return prisma.policyVersion.findMany({
    where: { policyId },
    orderBy: { version: "desc" },
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

exports.createDataRequest = async (data, adminId) => {
  const request = await prisma.dataRequest.create({
    data: {
      type: data.type,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      requestedById: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_DATA_REQUEST",
      entity: "DataRequest",
      entityId: request.id,
      performedById: adminId,
    },
  });

  return request;
};

exports.listDataRequests = async (query) => {
  const { type, status } = query;

  return prisma.dataRequest.findMany({
    where: {
      ...(type && { type }),
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
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

    if (!request) throw new Error("Request not found");
    if (request.status !== "PENDING") throw new Error("Already processed");

    const updated = await tx.dataRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    if (request.type === "DELETE") {
      await createPurgeQueue(tx, request.id);
    }

    await tx.auditLog.create({
      data: {
        action: "APPROVE_DATA_REQUEST",
        entity: "DataRequest",
        entityId: request.id,
        performedById: adminId,
      },
    });

    return updated;
  });
};

exports.rejectDataRequest = async (requestId, adminId) => {
  return prisma.dataRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      approvedById: adminId,
      approvedAt: new Date(),
    },
  });
};

/*
|--------------------------------------------------------------------------
| PURGE QUEUE
|--------------------------------------------------------------------------
*/

exports.listPurgeQueue = async (query) => {
  const { status } = query;

  return prisma.purgeQueue.findMany({
    where: {
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.getPurgeQueueItem = async (queueId) => {
  return prisma.purgeQueue.findUnique({
    where: { id: queueId },
  });
};

exports.retryPurgeJob = async (queueId) => {
  return prisma.purgeQueue.update({
    where: { id: queueId },
    data: {
      status: "PENDING",
      attempts: { increment: 1 },
      lastError: null,
    },
  });
};

/*
|--------------------------------------------------------------------------
| CONSENT LOGS (READ ONLY)
|--------------------------------------------------------------------------
*/

exports.listConsentLogs = async (query) => {
  const { userId, businessId, type } = query;

  return prisma.consentLog.findMany({
    where: {
      ...(userId && { userId }),
      ...(businessId && { businessId }),
      ...(type && { type }),
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.getConsentLogById = async (logId) => {
  return prisma.consentLog.findUnique({
    where: { id: logId },
  });
};
