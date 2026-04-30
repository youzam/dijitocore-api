const prisma = require("../../config/prisma");
const auditHelper = require("../../utils/audit.helper");

const createPurgeQueue = async (tx, dataRequestId) => {
  return tx.purgeQueue.create({
    data: {
      dataRequestId,
      status: "PENDING",
    },
  });
};

exports.createDataRequest = async (data, user) => {
  let requestedByUserId = null;
  let requestedByCustomerId = null;

  if (user.role === "CUSTOMER") {
    requestedByCustomerId = user.id;
  } else {
    requestedByUserId = user.id;
  }

  // 🔍 validation
  if (requestedByUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: requestedByUserId },
    });

    if (!dbUser) {
      throw new Error("User not found");
    }

    if (data.targetType === "USER" && data.targetId !== dbUser.id) {
      throw new Error("Users can only request their own data");
    }

    if (data.targetType === "BUSINESS" && dbUser.role !== "BUSINESS_OWNER") {
      throw new Error("Only business owner can request business data");
    }
  }

  if (requestedByCustomerId) {
    if (
      data.targetType !== "CUSTOMER" ||
      data.targetId !== requestedByCustomerId
    ) {
      throw new Error("Customers can only request their own data");
    }
  }

  // 🔍 prevent duplicate active requests
  const existing = await prisma.dataRequest.findFirst({
    where: {
      type: data.type,
      status: { in: ["PENDING", "PROCESSING"] },
      OR: [{ requestedByUserId }, { requestedByCustomerId }],
    },
  });

  if (existing) {
    throw new Error("Active request already exists for this type");
  }

  // 🔥 TRANSACTION: create request + enqueue purge
  const request = await prisma.$transaction(async (tx) => {
    const createdRequest = await tx.dataRequest.create({
      data: {
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        requestedByUserId,
        requestedByCustomerId,
      },
    });

    await createPurgeQueue(tx, createdRequest.id);

    return createdRequest;
  });

  // 🧾 audit (outside transaction)
  await auditHelper.logAudit({
    userId: user.id,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "DATA_REQUEST_CREATED",
    module: "PRIVACY",
    actorType: user.role === "CUSTOMER" ? "CUSTOMER" : "USER",
  });

  return request;
};

exports.getMyDataRequests = async (user) => {
  const whereClause =
    user.role === "CUSTOMER"
      ? { requestedByCustomerId: user.id }
      : { requestedByUserId: user.id };

  return prisma.dataRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });
};

exports.getMyDataRequestById = async (id, user) => {
  const whereClause =
    user.role === "CUSTOMER"
      ? {
          id,
          requestedByCustomerId: user.id,
        }
      : {
          id,
          requestedByUserId: user.id,
        };

  const request = await prisma.dataRequest.findFirst({
    where: whereClause,
  });

  if (!request) {
    throw new Error("Request not found");
  }

  return request;
};

/**
 * Create consent (GRANT)
 */
exports.createConsent = async (data, user) => {
  const consent = await prisma.consentLog.create({
    data: {
      userId: user.id || null,
      businessId: user.businessId || null,
      type: data.type,
      status: "GRANTED",
      source: data.source || "SYSTEM",
      metadata: data.metadata || {},
    },
  });

  await auditHelper.logAudit({
    userId: user.id || null,
    entityType: "CONSENT",
    entityId: consent.id,
    action: "CONSENT_GRANTED",
    module: "PRIVACY",
    actorType: "USER",
  });

  return consent;
};

/**
 * Update consent (GRANT / REVOKE)
 */
exports.updateConsent = async (data, user) => {
  const existing = await prisma.consentLog.findFirst({
    where: {
      type: data.type,
      OR: [
        { userId: user.id || null },
        { businessId: user.businessId || null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    throw new Error("Consent not found");
  }

  const consent = await prisma.consentLog.create({
    data: {
      userId: user.id || null,
      businessId: user.businessId || null,
      type: data.type,
      status: data.status, // GRANTED / REVOKED
      source: data.source || "USER_ACTION",
      metadata: data.metadata || {},
    },
  });

  await auditHelper.logAudit({
    userId: user.id || null,
    entityType: "CONSENT",
    entityId: consent.id,
    action: data.status === "GRANTED" ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
    module: "PRIVACY",
    actorType: "USER",
  });

  return consent;
};

/**
 * Get my consents
 */
exports.getMyConsents = async (user) => {
  return prisma.consentLog.findMany({
    where: {
      OR: [
        { userId: user.id || null },
        { businessId: user.businessId || null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
};
