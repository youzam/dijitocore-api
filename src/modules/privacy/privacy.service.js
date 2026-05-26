const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const auditHelper = require('../../utils/audit.helper');

const getActiveLegalPolicies = async () => {
  const [terms, privacy] = await Promise.all([
    prisma.legalPolicyDocument.findFirst({
      where: { type: 'TERMS', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.legalPolicyDocument.findFirst({
      where: { type: 'PRIVACY', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!terms || !privacy) {
    throw new AppError('privacy.active_policy_missing', 500);
  }

  return { terms, privacy };
};

exports.hasAcceptedLatestTermsAndPrivacy = async ({
  actorType,
  userId = null,
  customerId = null,
}) => {
  const { terms, privacy } = await getActiveLegalPolicies();

  const consent = await prisma.consentLog.findFirst({
    where: {
      actorType,
      userId,
      customerId,
      type: 'TERMS_AND_PRIVACY',
      status: 'GRANTED',
      termsVersion: terms.version,
      privacyVersion: privacy.version,
      isDeleted: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  return Boolean(consent);
};

exports.acceptTermsAndPrivacy = async ({
  actorType,
  userId = null,
  customerId = null,
  businessId = null,
  source = 'SYSTEM',
  metadata = {},
  ipAddress = null,
  userAgent = null,
  deviceId = null,
}) => {
  const { terms, privacy } = await getActiveLegalPolicies();

  const consent = await prisma.consentLog.create({
    data: {
      actorType,
      userId,
      customerId,
      businessId,
      type: 'TERMS_AND_PRIVACY',
      status: 'GRANTED',
      termsVersion: terms.version,
      privacyVersion: privacy.version,
      source,
      metadata,
      ipAddress,
      userAgent,
      deviceId,
    },
  });

  await auditHelper.logAudit({
    businessId,
    userId,
    customerId,
    entityType: 'CONSENT',
    entityId: consent.id,
    action: 'CONSENT_GRANTED',
    module: 'PRIVACY',
    actorType,
  });

  return consent;
};

exports.createDataRequest = async (data, dbUser, dbCustomer) => {
  return await prisma.$transaction(async (tx) => {
    let requestedByUserId = null;
    let requestedByCustomerId = null;

    // 🧑 USER FLOW
    if (dbUser) {
      requestedByUserId = dbUser.id;

      if (data.targetType === 'USER' && data.targetId !== dbUser.id) {
        throw new AppError('Users can only request their own data');
      }
    }

    // 👤 CUSTOMER FLOW
    if (dbCustomer) {
      requestedByCustomerId = dbCustomer.id;

      if (
        data.targetType !== 'CUSTOMER' ||
        data.targetId !== requestedByCustomerId
      ) {
        throw new AppError('Customers can only request their own data');
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
      throw new AppError('A similar request is already in progress');
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
    throw new AppError('Request not found');
  }

  return request;
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
