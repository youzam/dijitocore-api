const prisma = require('../../config/prisma');
const auditHelper = require('../../utils/audit.helper');

exports.createDataRequest = async (data, dbUser, dbCustomer) => {
  return await prisma.$transaction(async (tx) => {
    let requestedByUserId = null;
    let requestedByCustomerId = null;

    // 🧑 USER FLOW
    if (dbUser) {
      requestedByUserId = dbUser.id;

      if (data.targetType === 'USER' && data.targetId !== dbUser.id) {
        throw new Error('Users can only request their own data');
      }
    }

    // 👤 CUSTOMER FLOW
    if (dbCustomer) {
      requestedByCustomerId = dbCustomer.id;

      if (
        data.targetType !== 'CUSTOMER' ||
        data.targetId !== requestedByCustomerId
      ) {
        throw new Error('Customers can only request their own data');
      }
    }

    // 🚫 Prevent duplicate active requests
    const existing = await tx.dataRequest.findFirst({
      where: {
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existing) {
      throw new Error('A similar request is already in progress');
    }

    // 🔥 FIX: Detect self-export
    const isSelfExport =
      data.type === 'EXPORT' &&
      ((requestedByUserId && data.targetId === requestedByUserId) ||
        (requestedByCustomerId && data.targetId === requestedByCustomerId));

    // 💾 Create request
    const createdRequest = await tx.dataRequest.create({
      data: {
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        requestedByUserId,
        requestedByCustomerId,

        // 🔥 AUTO-APPROVE SELF EXPORT (ONLY CHANGE)
        ...(isSelfExport && { approvedAt: new Date() }),
      },
    });

    // 📦 Push to purge queue (UNCHANGED)
    await tx.purgeQueue.create({
      data: {
        dataRequestId: createdRequest.id,
      },
    });

    // 🧾 AUDIT LOG (UNCHANGED — IMPORTANT)
    await tx.auditLog.create({
      data: {
        action: 'DATA_REQUEST_CREATED',
        entityType: 'DATA_REQUEST',
        entityId: createdRequest.id,
        userId: requestedByUserId,
        metadata: {
          type: data.type,
          targetType: data.targetType,
          targetId: data.targetId,
        },
      },
    });

    return createdRequest;
  });
};

exports.getMyDataRequests = async (user) => {
  const whereClause =
    user.role === 'CUSTOMER'
      ? { requestedByCustomerId: user.id }
      : { requestedByUserId: user.id };

  return prisma.dataRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  });
};

exports.getMyDataRequestById = async (id, user) => {
  const whereClause =
    user.role === 'CUSTOMER'
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
    throw new Error('Request not found');
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
      status: 'GRANTED',
      source: data.source || 'SYSTEM',
      metadata: data.metadata || {},
    },
  });

  await auditHelper.logAudit({
    userId: user.id || null,
    entityType: 'CONSENT',
    entityId: consent.id,
    action: 'CONSENT_GRANTED',
    module: 'PRIVACY',
    actorType: 'USER',
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
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    throw new Error('Consent not found');
  }

  const consent = await prisma.consentLog.create({
    data: {
      userId: user.id || null,
      businessId: user.businessId || null,
      type: data.type,
      status: data.status, // GRANTED / REVOKED
      source: data.source || 'USER_ACTION',
      metadata: data.metadata || {},
    },
  });

  await auditHelper.logAudit({
    userId: user.id || null,
    entityType: 'CONSENT',
    entityId: consent.id,
    action: data.status === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
    module: 'PRIVACY',
    actorType: 'USER',
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
    orderBy: { createdAt: 'desc' },
  });
};
