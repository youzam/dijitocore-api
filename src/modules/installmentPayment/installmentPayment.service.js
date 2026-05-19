const prisma = require('../../config/prisma');
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
const uploadPaymentAttachment = async (attachment) => {
  if (!attachment) {
    return null;
  }

  const upload = await storageManager.uploadFile({
    key: `payments/attachments/${Date.now()}-${attachment.name}`,

    body: attachment.data,
  });

  return upload?.key || upload?.url || null;
};

const validatePaymentContext = async ({
  tx,
  businessId,
  contractId,
  customerId,
  amount,
  reference,
  idempotencyKey,
  userId,
}) => {
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
        existingPayment: existing,
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

  const customer = await tx.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
  });

  if (!customer) {
    throw new Error('customer.not_found');
  }

  if (customer.status === 'INACTIVE' || customer.isBlacklisted) {
    throw new Error('customer.inactiveBlacklisted');
  }

  const contract = await tx.contract.findFirst({
    where: {
      id: contractId,
      businessId,
    },

    include: {
      schedules: true,
      customer: true,
    },
  });

  if (!contract) {
    throw new Error('contract.not_found');
  }

  if (contract.customerId !== customerId) {
    throw new Error('payment.customer_mismatch');
  }

  if (['TERMINATED', 'COMPLETED'].includes(contract.status)) {
    throw new Error('contract.closed');
  }

  if (amount > contract.outstandingAmount) {
    throw new Error('payment.exceeds_outstanding_amount');
  }

  if (amount <= 0) {
    throw new Error('payment.invalid_amount');
  }

  return {
    customer,
    contract,
  };
};

const allocatePaymentToSchedules = async ({ tx, schedules, amount }) => {
  let remaining = amount;

  const ordered = schedules
    .filter((s) => s.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  for (const s of ordered) {
    if (remaining <= 0) {
      break;
    }

    const unpaid = s.amount - (s.paidAmount || 0);

    if (unpaid <= 0) {
      continue;
    }

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
};

const createPaymentLedger = async ({ payment, ledgerContext }) => {
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
    referenceType: ledgerService.REFERENCE_TYPES.CUSTOMER_INSTALLMENT_PAYMENT,
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
};

const notifyPaymentStakeholders = async ({
  businessId,
  customerId,
  contractId,
  payment,
}) => {
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
};

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
  await subscriptionAuthority.assertActiveSubscription(businessId);

  const uploadedAttachment = await uploadPaymentAttachment(attachment);

  const { payment, ledgerContext } = await prisma.$transaction(async (tx) => {
    const validation = await validatePaymentContext({
      tx,
      businessId,
      contractId,
      customerId,
      amount,
      reference,
      idempotencyKey,
      userId,
    });

    if (validation.existingPayment) {
      return {
        payment: validation.existingPayment,

        ledgerContext: {
          businessId,
          contractId,
          customerId,
          businessName: null,
          country: null,
        },
      };
    }

    const { contract } = validation;

    await allocatePaymentToSchedules({
      tx,
      schedules: contract.schedules,
      amount,
    });

    const newPaidAmount = contract.paidAmount + amount;

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

    const createdPayment = await tx.installmentPayment.create({
      data: {
        businessId,
        contractId,
        customerId,
        amount,
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

  await createPaymentLedger({
    payment,
    ledgerContext,
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

  await notifyPaymentStakeholders({
    businessId,
    customerId,
    contractId,
    payment,
  });

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
  // 🔒 SUBSCRIPTION ENFORCEMENT
  await subscriptionAuthority.assertActiveSubscription(businessId);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.installmentPayment.findFirst({
      where: {
        id: paymentId,
        businessId,
      },
    });

    if (!payment) {
      throw new Error('payment.not_found');
    }

    const existingApprovedReversal = await tx.paymentReversal.findFirst({
      where: {
        paymentId: payment.id,
        status: 'APPROVED',
      },
    });

    if (existingApprovedReversal) {
      throw new Error('payment.already_reversed');
    }

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

    // 🔒 LIMIT ENFORCEMENT
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

      return {
        reversal,
        autoApproved: true,
      };
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
  reversalId,
  internalPayment,
  internalReversal,
  tx,
}) => {
  const trx = tx || prisma;

  let reversal = internalReversal;

  if (!reversal && reversalId) {
    reversal = await trx.paymentReversal.findFirst({
      where: {
        id: reversalId,
      },
    });
  }

  if (!reversal) {
    throw new Error('reversal.not_found');
  }

  return tx
    ? executeApproval({
        trx,
        businessId,
        approverId,
        payment: internalPayment,
        reversal,
      })
    : prisma.$transaction(async (db) => {
        return executeApproval({
          trx: db,
          businessId,
          approverId,
          payment: internalPayment,
          reversal,
        });
      });
};

const executeApproval = async ({
  trx,
  businessId,
  approverId,
  payment,
  reversal,
}) => {
  if (!reversal) {
    throw new Error('reversal.not_found');
  }
  if (!payment) {
    payment = await trx.installmentPayment.findFirst({
      where: {
        id: reversal.paymentId,
      },
    });
  }

  if (!payment) {
    throw new Error('payment.not_found');
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

  const affectedSchedules = contract.schedules
    .filter((s) => s.status === 'PAID' || s.status === 'PARTIAL')
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

  for (const s of affectedSchedules) {
    if (rollback <= 0) {
      break;
    }

    const currentPaid = s.paidAmount || 0;

    if (currentPaid <= 0) {
      continue;
    }

    const deduction = Math.min(rollback, currentPaid);

    const newPaidAmount = currentPaid - deduction;

    let nextStatus = 'DUE';

    if (newPaidAmount >= s.amount) {
      nextStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      nextStatus = 'PARTIAL';
    }

    await trx.installmentSchedule.update({
      where: {
        id: s.id,
      },

      data: {
        paidAmount: newPaidAmount,
        status: nextStatus,
        paidAt: nextStatus === 'PAID' ? s.paidAt || new Date() : null,
      },
    });

    rollback -= deduction;
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

    referenceType: ledgerService.REFERENCE_TYPES.CUSTOMER_REFUND,

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

  await trx.PaymentReversal.update({
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
  const {
    page = 1,
    limit = 20,
    search,
    contractId,
    customerId,
    status,
    startDate,
    endDate,
  } = req.query;

  const where = {
    businessId: req.user.businessId,
  };

  if (search) {
    where.reference = {
      contains: search,
      mode: 'insensitive',
    };
  }

  if (contractId) {
    where.contractId = contractId;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.createdAt = {};

    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }

    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [payments, total] = await Promise.all([
    prisma.installmentPayment.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            customer: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },

        reversals: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: Number(limit),
    }),

    prisma.installmentPayment.count({
      where,
    }),
  ]);

  return {
    data: payments,

    meta: {
      total,

      page: Number(page),
      limit: Number(limit),

      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * LIST REVERSALS (USING FACTORY)
 */
exports.listReversals = async (req) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);

  const skip = (page - 1) * limit;

  const where = {
    Payment: {
      businessId: req.user.businessId,
    },
  };

  if (req.query.status) {
    where.status = req.query.status;
  }

  const [reversals, total] = await Promise.all([
    prisma.PaymentReversal.findMany({
      where,
      include: {
        Payment: {
          select: {
            id: true,
            amount: true,
            reference: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.PaymentReversal.count({
      where,
    }),
  ]);

  return {
    data: reversals,

    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
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
