const prisma = require('../../../config/prisma');
const AppError = require('../../../utils/AppError');
const { logAudit } = require('../../../utils/audit.helper');
const ledgerService = require('../../../services/ledger.service');

/**
 * Refund Transaction (Enterprise)
 */
exports.refundTransaction = async (transactionId, actor) => {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: transactionId },
    });

    if (!payment) {
      throw new AppError('commerce.transaction_not_found', 404);
    }

    if (payment.status === 'REFUNDED') {
      throw new AppError('commerce.already_refunded', 400);
    }

    if (payment.status !== 'CONFIRMED') {
      throw new AppError('commerce.invalid_refund_state', 400);
    }

    await tx.subscriptionPayment.update({
      where: { id: transactionId },

      data: {
        status: 'REFUNDED',
      },
    });

    const subscription = await tx.subscription.findUnique({
      where: {
        id: payment.subscriptionId,
      },
    });

    if (!subscription) {
      throw new AppError('subscription.not_found', 404);
    }

    const graceUntil = new Date();

    graceUntil.setDate(graceUntil.getDate() + 2);

    await tx.subscription.update({
      where: {
        id: subscription.id,
      },

      data: {
        graceUntil,
      },
    });

    const business = await tx.business.findUnique({
      where: {
        id: subscription.businessId,
      },

      select: {
        name: true,
        country: true,
      },
    });

    const pkg = await tx.subscriptionPackage.findUnique({
      where: {
        id: subscription.packageId,
      },

      select: {
        name: true,
      },
    });

    const snapshots = ledgerService.buildSnapshots({
      business,
      packageData: pkg,
    });

    await ledgerService.recordDoubleEntryTx(tx, {
      scopeType: ledgerService.SCOPE_TYPES.SYSTEM,

      businessId: subscription.businessId,

      referenceId: payment.id,

      referenceType: ledgerService.REFERENCE_TYPES.SYSTEM_REFUND,

      transactionType: 'REFUND',

      amount: payment.amount,

      currency: payment.currency,

      status: 'POSTED',

      gateway: payment.gateway,

      retryCount: payment.retryCount || 0,

      subscriptionAmount: payment.subscriptionAmount || 0,

      setupFeeAmount: payment.setupFeeAmount || 0,

      subscriptionId: subscription.id,

      packageId: subscription.packageId,

      businessNameSnapshot: snapshots.businessNameSnapshot,

      packageNameSnapshot: snapshots.packageNameSnapshot,

      countrySnapshot: snapshots.countrySnapshot,

      metadata: {
        refundedBy: actor?.id || null,

        refundedAt: new Date().toISOString(),

        originalStatus: payment.status,
      },

      entries: [
        {
          accountType: ledgerService.ACCOUNT_TYPES.SYSTEM_REFUND,

          direction: ledgerService.DIRECTIONS.DEBIT,
        },

        {
          accountType: ledgerService.ACCOUNT_TYPES.SYSTEM_CASH,

          direction: ledgerService.DIRECTIONS.CREDIT,
        },
      ],
    });

    await logAudit({
      userId: actor?.id || null,

      entityType: 'PAYMENT',

      entityId: transactionId,

      action: 'PAYMENT_REFUNDED',

      metadata: {
        subscriptionId: payment.subscriptionId,

        amount: payment.amount,

        previousStatus: payment.status,

        newStatus: 'REFUNDED',

        graceUntil,
      },

      module: 'COMMERCE',

      actorType: 'ADMIN',
    });

    return {
      refunded: true,
      graceUntil,
    };
  });
};

/**
 * Create Financial Adjustment (CREDIT / DEBIT)
 */
exports.createAdjustment = async (data, actor) => {
  const { businessId, amount, reason, type, createdBy } = data;

  if (!businessId) {
    throw new AppError('commerce.business_required', 400);
  }

  if (!amount || Number(amount) === 0) {
    throw new AppError('commerce.invalid_amount', 400);
  }

  if (!reason) {
    throw new AppError('commerce.adjustment_reason_required', 400);
  }

  if (!type) {
    throw new AppError('commerce.adjustment_type_required', 400);
  }

  if (!createdBy) {
    throw new AppError('commerce.created_by_required', 400);
  }

  return prisma.$transaction(async (tx) => {
    const adjustment = await tx.financialAdjustment.create({
      data,
    });

    const business = await tx.business.findUnique({
      where: {
        id: businessId,
      },

      select: {
        name: true,
        country: true,
      },
    });

    const snapshots = ledgerService.buildSnapshots({
      business,
      packageData: null,
    });

    const isCredit = type === 'CREDIT';

    const systemSetting = await tx.systemSetting.findFirst({
      select: {
        currency: true,
      },
    });

    await ledgerService.recordDoubleEntryTx(tx, {
      scopeType: ledgerService.SCOPE_TYPES.SYSTEM,

      businessId,

      referenceId: adjustment.id,

      referenceType: ledgerService.REFERENCE_TYPES.SYSTEM_ADJUSTMENT,

      transactionType: 'ADJUSTMENT',

      amount,

      currency: systemSetting?.currency || 'TZS',

      status: 'POSTED',

      businessNameSnapshot: snapshots.businessNameSnapshot,

      countrySnapshot: snapshots.countrySnapshot,

      metadata: {
        reason,
        type,
        createdBy,
        actorId: actor?.id || null,
      },

      entries: [
        {
          accountType: ledgerService.ACCOUNT_TYPES.SYSTEM_ADJUSTMENT,

          direction: isCredit
            ? ledgerService.DIRECTIONS.CREDIT
            : ledgerService.DIRECTIONS.DEBIT,
        },

        {
          accountType: ledgerService.ACCOUNT_TYPES.SYSTEM_CASH,

          direction: isCredit
            ? ledgerService.DIRECTIONS.DEBIT
            : ledgerService.DIRECTIONS.CREDIT,
        },
      ],
    });

    await logAudit({
      userId: actor?.id || null,

      entityType: 'FINANCIAL_ADJUSTMENT',

      entityId: adjustment.id,

      action: 'FINANCIAL_ADJUSTMENT_CREATED',

      metadata: {
        businessId,
        amount,
        type,
        reason,
      },

      module: 'COMMERCE',

      actorType: 'ADMIN',
    });

    return adjustment;
  });
};

/**
 * Regenerate Invoice
 */
exports.regenerateInvoice = async (transactionId, actor) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: {
      id: transactionId,
    },
  });

  if (!payment) {
    throw new AppError('commerce.transaction_not_found', 404);
  }

  if (!transactionId) {
    throw new AppError('commerce.transaction_id_required', 400);
  }

  const newInvoiceUrl = `https://invoices.DijitoPay.com/${payment.id}`;

  const updated = await prisma.subscriptionPayment.update({
    where: {
      id: transactionId,
    },

    data: {
      invoiceUrl: newInvoiceUrl,

      adminOverride: true,

      metadata: {
        ...(payment.metadata || {}),

        invoiceRegeneratedAt: new Date(),
      },
    },
  });

  await logAudit({
    userId: actor?.id || null,

    entityType: 'PAYMENT',

    entityId: transactionId,

    action: 'INVOICE_REGENERATED',

    metadata: {
      invoiceUrl: updated.invoiceUrl,
    },

    module: 'COMMERCE',

    actorType: 'ADMIN',
  });

  return {
    id: updated.id,
    invoiceUrl: updated.invoiceUrl,
  };
};
