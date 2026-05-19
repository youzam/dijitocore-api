const prisma = require('../../config/prisma');
const factory = require('../../utils/handlerFactory');
const { logAudit } = require('../../utils/audit.helper');

const {
  createNotification,
} = require('../../services/notifications/notification.service');
const approvalEngine = require('../../services/approval/approval.engine');
const subscriptionAuthority = require('../subscription/subscription.authority.service');
const { handleSecurityIncident } = require('../../utils/incidentEngine');
const AppError = require('../../utils/AppError');
const ledgerService = require('../../services/ledger.service');
const storageManager = require('../../utils/storage/storage.manager');

/**
 * Guard: Payment update allowed only via reversal flow.
 * @param {Object} params
 * @param {string} params.flow - expected "REVERSAL"
 * @param {Object} params.user
 * @param {string} params.paymentId
 * @param {Object} params.attemptedChanges
 */
async function guardPaymentMutation({
  flow,
  user,
  paymentId,
  attemptedChanges,
}) {
  // ✅ ALLOW ONLY REVERSAL FLOW
  if (flow === 'REVERSAL') return;

  // 🔴 BLOCK ANY OTHER ATTEMPT
  await handleSecurityIncident({
    type: 'PAYMENT_TAMPERING_ATTEMPT',
    title: 'Unauthorized payment mutation attempt',
    description: `User ${user?.id} attempted direct payment modification`,
    source: 'API',
    referenceId: paymentId,
    metadata: {
      userId: user?.id,
      role: user?.role,
      attemptedChanges,
    },
  });

  throw new AppError('payment.update_forbidden', 403);
}

/**
 * RECORD PAYMENT (HARDENED & SAFE)
 */
exports.recordPayment = async ({
  businessId,
  contractId,
  customerId,
  amount,
  channel,
  source,
  reference,
  idempotencyKey,
  attachment,
  receivedAt,
  userId,
}) => {
  // 🔒 SUBSCRIPTION ENFORCEMENT (SAFE INJECTION)
  await subscriptionAuthority.assertActiveSubscription(businessId);

  let uploadedAttachment = null;

  if (attachment) {
    const upload = await storageManager.upload({
      file: attachment,
      folder: 'payments/attachments',
    });

    uploadedAttachment = upload?.key || upload?.url || null;
  }

  const { payment, ledgerContext } = await prisma.$transaction(async (tx) => {
    /* =====================================================
           IDEMPOTENCY CHECK
           ===================================================== */
    if (idempotencyKey) {
      const existing = await tx.installmentPayment.findFirst({
        where: {
          businessId,
          idempotencyKey,
        },
      });

      if (existing) {
        await logAudit({
          businessId,
          userId,
          entityType: 'PAYMENT',
          entityId: existing.id,
          action: 'PAYMENT_IDEMPOTENT_HIT',
        });

        return {
          payment: existing,
          ledgerContext: {
            businessId,
            contractId,
            customerId,
            businessName: null,
            country: null,
          },
        };
      }
    }

    if (reference) {
      const duplicate = await tx.installmentPayment.findFirst({
        where: {
          businessId,
          contractId,
          reference,
          amount,
        },
      });

      if (duplicate) {
        await handleSecurityIncident({
          type: 'DUPLICATE_PAYMENT_ATTEMPT',

          source: 'API',

          referenceId: contractId,

          metadata: {
            reference,
            amount,
            contractId,
            existingPaymentId: duplicate.id,
          },
        });

        throw new Error('payment.duplicate_detected');
      }
    }

    /* =====================================================
           VALIDATE CUSTOMER
           ===================================================== */
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
    });

    if (!customer) throw new Error('customer.not_found');

    if (customer.status === 'INACTIVE' || customer.isBlacklisted) {
      throw new Error('customer.inactiveBlacklisted');
    }

    /* =====================================================
           VALIDATE CONTRACT
           ===================================================== */
    const contract = await tx.contract.findFirst({
      where: {
        id: contractId,
        businessId,
      },

      include: {
        schedules: true,

        business: {
          include: {
            users: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!contract) throw new Error('contract.not_found');

    if (contract.customerId !== customerId) {
      throw new Error('payment.customer_mismatch');
    }

    if (['TERMINATED', 'COMPLETED'].includes(contract.status)) {
      throw new Error('contract.closed');
    }

    /* =====================================================
           VALIDATE PAYMENT AMOUNT
           ===================================================== */

    if (amount > contract.outstandingAmount) {
      throw new Error('payment.exceeds_outstanding_amount');
    }

    if (amount <= 0) {
      throw new Error('payment.invalid_amount');
    }

    /* =====================================================
           CALCULATE PAYABLE
           ===================================================== */

    const payable = amount;

    let remaining = payable;

    const schedules = contract.schedules
      .filter((s) => s.status !== 'PAID')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    for (const s of schedules) {
      if (remaining <= 0) break;

      const unpaid = s.amount - (s.paidAmount || 0);

      if (unpaid <= 0) continue;

      const allocation = Math.min(remaining, unpaid);

      const newPaidAmount = (s.paidAmount || 0) + allocation;

      const fullyPaid = newPaidAmount >= s.amount;

      await tx.installmentSchedule.update({
        where: {
          id: s.id,
        },

        data: {
          paidAmount: newPaidAmount,

          status: fullyPaid ? 'PAID' : 'PARTIAL',

          paidAt: fullyPaid ? new Date() : null,
        },
      });

      remaining -= allocation;
    }

    const newPaidAmount = contract.paidAmount + payable;

    const newOutstanding = Math.max(contract.totalValue - newPaidAmount, 0);

    await tx.contract.update({
      where: {
        id: contractId,
      },

      data: {
        paidAmount: newPaidAmount,

        outstandingAmount: newOutstanding,

        ...(newOutstanding === 0 && {
          completedAt: new Date(),

          status: 'COMPLETED',
        }),
      },
    });

    /* =====================================================
           CREATE PAYMENT ENTRY
           ===================================================== */

    const createdPayment = await tx.installmentPayment.create({
      data: {
        businessId,
        contractId,
        customerId,
        amount: payable,
        channel,

        source: source || 'POS',

        reference,

        idempotencyKey,

        attachment: uploadedAttachment,

        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),

        balanceBefore: contract.outstandingAmount,

        balanceAfter: newOutstanding,

        recordedBy: userId,

        status: 'POSTED',
      },
    });

    return {
      payment: createdPayment,

      ledgerContext: {
        businessId,

        contractId,

        customerId,

        businessName: contract.business?.name || null,

        country: contract.business?.country || null,
      },
    };
  });

  /* =====================================================
     TENANT LEDGER ENTRY
     ===================================================== */

  const snapshots = ledgerService.buildSnapshots({
    business: {
      name: ledgerContext.businessName,

      country: ledgerContext.country,
    },

    packageData: null,
  });

  await ledgerService.recordDoubleEntry({
    scopeType: ledgerService.SCOPE_TYPES.TENANT,

    businessId: ledgerContext.businessId,

    customerId: ledgerContext.customerId,

    contractId: ledgerContext.contractId,

    referenceId: payment.id,

    referenceType: ledgerService.REFERENCE_TYPES.CUSTOMER_PAYMENT,

    transactionType: 'PAYMENT',

    amount: payment.amount,

    currency: payment.currency || 'TZS',

    status: 'POSTED',

    businessNameSnapshot: snapshots.businessNameSnapshot,

    countrySnapshot: snapshots.countrySnapshot,

    metadata: {
      paymentMethod: payment.channel,

      source: payment.source,

      reference: payment.reference,

      recordedBy: payment.recordedBy,

      createdAt: new Date().toISOString(),
    },

    entries: [
      {
        accountType: ledgerService.ACCOUNT_TYPES.TENANT_CASH,

        direction: ledgerService.DIRECTIONS.DEBIT,
      },

      {
        accountType: ledgerService.ACCOUNT_TYPES.TENANT_RECEIVABLE,

        direction: ledgerService.DIRECTIONS.CREDIT,
      },
    ],
  });

  await logAudit({
    businessId,
    userId,
    entityType: 'PAYMENT',
    entityId: payment.id,
    action: 'PAYMENT_RECORDED',
    metadata: {
      amount: payment.amount,
      contractId,
      customerId,
      reference: payment.reference,
      channel: payment.channel,
    },
  });

  /* =====================================================
     NOTIFICATIONS
     ===================================================== */

  await createNotification({
    businessId,
    customerId,
    contractId,
    type: 'PAYMENT',
    channel: 'SMS',
    titleKey: 'notification.payment.title',
    messageKey: 'notification.payment.body',
    templateVars: {
      amount: payment.amount,
      reference: payment.reference,
    },
    recipient: customerId,
  });

  await createNotification({
    businessId,
    customerId,
    contractId,
    type: 'PAYMENT',
    channel: 'IN_APP',
    titleKey: 'notification.payment.title',
    messageKey: 'notification.payment.body',
    templateVars: {
      amount: payment.amount,
      reference: payment.reference,
    },
    recipient: customerId,
  });

  const businessUsers = await prisma.user.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
    },
  });

  for (const u of businessUsers) {
    await createNotification({
      businessId,
      userId: u.id,
      contractId,
      type: 'PAYMENT',
      channel: 'IN_APP',
      titleKey: 'notification.payment.staff.title',
      messageKey: 'notification.payment.staff.body',
      templateVars: {
        amount: payment.amount,
        reference: payment.reference,
      },
      recipient: u.id,
    });
  }

  return payment;
};

/**
 * REQUEST REVERSAL (HARDENED)
 */
exports.requestReversal = async ({
  businessId,
  paymentId,
  reason,
  userId,
  role,
}) => {
  // 🔒 SUBSCRIPTION ENFORCEMENT (SAFE INJECTION)
  await subscriptionAuthority.assertActiveSubscription(businessId);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.installmentPayment.findFirst({
      where: { id: paymentId, businessId },
    });

    if (!payment) throw new Error('payment.not_found');

    if (payment.status === 'REVERSED') {
      throw new Error('payment.already_reversed');
    }

    const existingPending = await tx.approvalRequest.findFirst({
      where: {
        businessId,
        entityType: 'PAYMENT',
        entityId: paymentId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new Error('approval.already_pending');
    }

    // 🔒 LIMIT ENFORCEMENT (SAFE INJECTION)
    const pendingApprovalsCount = await tx.approvalRequest.count({
      where: {
        businessId,
        status: 'PENDING',
      },
    });

    await subscriptionAuthority.assertLimit(
      businessId,
      'maxApprovalRequests',
      pendingApprovalsCount,
    );

    // OWNER AUTO APPROVAL
    if (role === 'BUSINESS_OWNER') {
      const reversal = await tx.paymentReversal.create({
        data: {
          paymentId,
          reason,
          requestedBy: userId,
          approvedBy: userId,
          approvedAt: new Date(),
          status: 'APPROVED',
        },
      });

      await exports.approveReversal({
        businessId,
        approverId: userId,
        internalPayment: payment,
        internalReversal: reversal,
        tx,
      });

      await logAudit({
        tx,
        businessId,
        userId,
        entityType: 'PAYMENT_REVERSAL',
        entityId: reversal.id,
        action: 'REVERSAL_REQUESTED',
      });

      return { reversal, autoApproved: true };
    }

    const reversal = await tx.paymentReversal.create({
      data: {
        paymentId,
        reason,
        requestedBy: userId,
        status: 'PENDING',
      },
    });

    const approval = await approvalEngine.createApproval({
      tx,
      businessId,
      entityType: 'PAYMENT',
      entityId: reversal.id,
      type: 'PAYMENT_REVERSAL',
      requestedBy: userId,
      reason,
    });

    return {
      reversal,
      approvalId: approval.id,
    };
  });
};

/**
 * APPROVE REVERSAL (HARDENED)
 */
exports.approveReversal = async ({
  businessId,
  approverId,
  internalPayment,
  internalReversal,
  tx,
}) => {
  return (tx || prisma).$transaction(async (trx) => {
    let reversal = internalReversal;
    let payment = internalPayment;

    if (payment.status === 'REVERSED') {
      throw new Error('payment.already_reversed');
    }

    await logAudit({
      tx: trx,
      businessId,
      userId: approverId,
      entityType: 'PAYMENT_REVERSAL',
      entityId: reversal.id,
      action: 'REVERSAL_APPROVED',
    });

    const contract = await trx.contract.findFirst({
      where: { id: payment.contractId },
      include: {
        schedules: true,
        business: true,
        customer: true,
      },
    });

    if (!contract) {
      throw new Error('contract.not_found');
    }

    if (contract.completedAt) {
      throw new Error('contract.closed');
    }

    if (payment.amount <= 0) {
      throw new Error('payment.invalid_reversal_amount');
    }

    let rollback = payment.amount;

    const paidSchedules = contract.schedules
      .filter((s) => s.status === 'PAID')
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    for (const s of paidSchedules) {
      if (rollback < s.amount) {
        break;
      }

      await trx.installmentSchedule.update({
        where: { id: s.id },
        data: {
          status: 'DUE',
          paidAt: null,
        },
      });

      rollback -= s.amount;
    }

    const newPaidAmount = Math.max(contract.paidAmount - payment.amount, 0);

    const newOutstanding = Math.min(
      contract.totalValue - newPaidAmount,
      contract.totalValue,
    );

    await trx.contract.update({
      where: {
        id: payment.contractId,
      },
      data: {
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding,
        completedAt: null,
        status: 'ACTIVE',
      },
    });

    await guardPaymentMutation({
      flow: 'REVERSAL',
      user: {
        id: approverId,
        role: 'TENANT',
      },
      paymentId: payment.id,
      attemptedChanges: {
        status: 'REVERSED',
      },
    });

    const reversalPayment = await trx.installmentPayment.create({
      data: {
        businessId,
        contractId: payment.contractId,
        customerId: payment.customerId,
        amount: -payment.amount,
        channel: 'REVERSAL',
        source: 'SYSTEM',
        balanceBefore: payment.balanceAfter,
        balanceAfter: newOutstanding,
        recordedBy: approverId,
        receivedAt: new Date(),
        status: 'POSTED',
      },
    });

    const snapshots = ledgerService.buildSnapshots({
      business: {
        name: contract.business?.name || null,
        country: contract.business?.country || null,
      },
      packageData: null,
    });

    await ledgerService.recordDoubleEntryTx(trx, {
      scopeType: ledgerService.SCOPE_TYPES.TENANT,

      businessId,

      customerId: payment.customerId,

      contractId: payment.contractId,

      referenceId: reversalPayment.id,

      referenceType: ledgerService.REFERENCE_TYPES.CUSTOMER_PAYMENT_REVERSAL,

      transactionType: 'REVERSAL',

      amount: payment.amount,

      currency: payment.currency || 'TZS',

      status: 'POSTED',

      businessNameSnapshot: snapshots.businessNameSnapshot,

      countrySnapshot: snapshots.countrySnapshot,

      metadata: {
        originalPaymentId: payment.id,
        reversalId: reversal.id,
        approvedBy: approverId,
        approvedAt: new Date().toISOString(),
      },

      entries: [
        {
          accountType: ledgerService.ACCOUNT_TYPES.TENANT_RECEIVABLE,

          direction: ledgerService.DIRECTIONS.DEBIT,
        },

        {
          accountType: ledgerService.ACCOUNT_TYPES.TENANT_CASH,

          direction: ledgerService.DIRECTIONS.CREDIT,
        },
      ],
    });

    await trx.installmentPayment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: 'REVERSED',
      },
    });

    await trx.installmentPaymentReversal.update({
      where: {
        id: reversal.id,
      },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    await createNotification({
      businessId,
      customerId: payment.customerId,
      contractId: payment.contractId,
      installmentPaymentId: payment.id,
      type: 'PAYMENT',
      channel: 'SMS',
      titleKey: 'notification.payment.reversed.title',
      messageKey: 'notification.payment.reversed.body',
      templateVars: {
        amount: payment.amount,
        receipt: payment.receiptNumber,
      },
      recipient: contract.customer?.phone,
    });

    if (contract.customer?.whatsappPhone) {
      await createNotification({
        businessId,
        customerId: payment.customerId,
        contractId: payment.contractId,
        installmentPaymentId: payment.id,
        type: 'PAYMENT',
        channel: 'WHATSAPP',
        titleKey: 'notification.payment.reversed.title',
        messageKey: 'notification.payment.reversed.body',
        templateVars: {
          amount: payment.amount,
          receipt: payment.receiptNumber,
        },
        recipient: contract.customer.whatsappPhone,
      });
    }

    return true;
  });
};

/**
 * REJECT REVERSAL
 */
exports.rejectReversal = async ({ businessId, approvalId, approverId }) => {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.findFirst({
      where: { id: approvalId, businessId, status: 'PENDING' },
    });

    if (!approval) throw new Error('payment.approval_not_found');

    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        resolvedAt: new Date(),
      },
    });

    await tx.paymentReversal.update({
      where: { id: approval.entityId },
      data: { status: 'REJECTED', approvedBy: approverId },
    });

    await logAudit({
      tx,
      businessId,
      userId: approverId,
      entityType: 'PAYMENT_REVERSAL',
      entityId: approval.entityId,
      action: 'REVERSAL_REJECTED',
    });

    return true;
  });
};

/**
 * LIST PAYMENTS (USING FACTORY)
 */
exports.listPayments = async (req) => {
  return factory.list({
    model: prisma.installmentPayment,
    query: req.query,
    businessFilter: { businessId: req.user.businessId },
    searchableFields: ['reference'],
    filterableFields: ['contractId', 'customerId', 'status'],
  });
};

/**
 * LIST REVERSALS (USING FACTORY)
 */
exports.listReversals = async (req) => {
  return factory.list({
    model: prisma.installmentPaymentReversal,
    query: req.query,
    businessFilter: {
      Payment: { businessId: req.user.businessId },
    },
    filterableFields: ['status'],
  });
};

exports.getCustomerPayments = async ({ customerId }) => {
  return prisma.installmentPayment.findMany({
    where: {
      customerId,
      status: 'POSTED',
    },
    orderBy: { createdAt: 'desc' },
  });
};
