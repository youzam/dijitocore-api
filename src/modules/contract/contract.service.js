const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

const AppError = require('../../utils/AppError');
const approvalEngine = require('../../services/approval/approval.engine'); // PATCH
const { logAudit } = require('../../utils/audit.helper'); // PATCH
const {
  createNotification,
} = require('../../services/notifications/notification.service');
const subscriptionAuthority = require('../subscription/subscription.authority.service');

/* ================= UTILITIES ================= */

const generateContractNumber = async (businessId) => {
  const count = await prisma.contract.count({ where: { businessId } });
  const year = new Date().getFullYear();
  return `CNT-${year}-${String(count + 1).padStart(5, '0')}`;
};

const generateScheduleDates = ({ startDate, frequency, customDays, total }) => {
  let current = dayjs(startDate);
  const dates = [];

  for (let i = 0; i < total; i++) {
    dates.push(current.toDate());

    if (frequency === 'DAILY') current = current.add(1, 'day');
    if (frequency === 'WEEKLY') current = current.add(1, 'week');
    if (frequency === 'MONTHLY') current = current.add(1, 'month');
    if (frequency === 'CUSTOM') current = current.add(customDays, 'day');
  }

  return dates;
};

/* ================= CREATE ================= */
exports.createContract = async (businessId, payload, userId) => {
  const {
    customerId,
    title,
    description,
    assets,
    totalValue,
    downPayment,
    installmentAmount,
    frequency,
    customDays,
    startDate,
  } = payload;

  await subscriptionAuthority.assertActiveSubscription(businessId);

  if (downPayment > totalValue) {
    throw new Error('contract.invalid-downpayment');
  }

  if (installmentAmount <= 0) {
    throw new Error('contract.invalid-installment');
  }

  if (frequency === 'CUSTOM' && !customDays) {
    throw new Error('contract.custom-days-required');
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
  });

  if (!customer) {
    throw new Error('contract.customer-not-found');
  }

  if (customer.status === 'INACTIVE' || customer.isBlacklisted) {
    throw new Error('customer.inactiveBlacklisted');
  }

  const assetNames = assets.map((a) => a.name.trim().toLowerCase());

  const existingContract = await prisma.contract.findFirst({
    where: {
      businessId,
      customerId,
      status: {
        in: ['DRAFT', 'ACTIVE'],
      },
      deletedAt: null,
      assets: {
        some: {
          name: {
            in: assetNames,
            mode: 'insensitive',
          },
        },
      },
    },
  });

  if (existingContract) {
    throw new Error('contract.customer_already_has_asset');
  }

  const balance = totalValue - downPayment;

  const totalInstallments = Math.ceil(balance / installmentAmount);

  const contractNumber = await generateContractNumber(businessId);

  const contract = await prisma.$transaction(async (tx) => {
    return tx.contract.create({
      data: {
        businessId,
        customerId,
        contractNumber,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        title,
        description,
        totalValue,
        downPayment,
        balance,
        installmentAmount,
        totalInstallments,
        paidAmount: 0,
        outstandingAmount: balance,
        frequency,
        customDays,
        startDate: new Date(startDate),
        status: 'DRAFT',
        createdBy: userId,
        assets: {
          create: assets.map((a) => ({
            name: a.name,
            quantity: a.quantity,
            unitPrice: a.unitPrice,
          })),
        },
      },
    });
  });

  await logAudit({
    businessId,
    userId,
    entityType: 'CONTRACT',
    entityId: contract.id,
    action: 'CONTRACT_CREATED',
    metadata: {
      contractNumber: contract.contractNumber,
      status: 'DRAFT',
      totalValue: contract.totalValue,
    },
  });

  return contract;
};

exports.activateContract = async (businessId, contractId, userId) => {
  await subscriptionAuthority.assertActiveSubscription(businessId);

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      businessId,
      deletedAt: null,
    },
    include: {
      customer: true,
    },
  });

  if (!contract) {
    throw new Error('contract.not-found');
  }

  if (contract.status !== 'DRAFT') {
    throw new Error('contract.invalid_activation');
  }

  const activeContractsCount = await prisma.contract.count({
    where: {
      businessId,
      status: 'ACTIVE',
      deletedAt: null,
    },
  });

  await subscriptionAuthority.assertLimit(
    businessId,
    'maxActiveContracts',
    activeContractsCount,
  );

  const dates = generateScheduleDates({
    startDate: contract.startDate,
    frequency: contract.frequency,
    customDays: contract.customDays,
    total: contract.totalInstallments,
  });

  const activated = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: {
        id: contract.id,
      },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    await tx.installmentSchedule.createMany({
      data: dates.map((d) => ({
        contractId: contract.id,
        dueDate: d,
        amount: contract.installmentAmount,
      })),
    });

    await tx.customer.update({
      where: {
        id: contract.customerId,
      },
      data: {
        totalContracts: {
          increment: 1,
        },
        activeContracts: {
          increment: 1,
        },
        totalOutstanding: {
          increment: contract.balance,
        },
      },
    });

    return updated;
  });

  await logAudit({
    businessId,
    userId,
    entityType: 'CONTRACT',
    entityId: contract.id,
    action: 'CONTRACT_ACTIVATED',
    metadata: {
      contractNumber: contract.contractNumber,
      totalValue: contract.totalValue,
    },
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: 'CONTRACT',
    channel: 'IN_APP',
    titleKey: 'notification.contract.active.title',
    messageKey: 'notification.contract.active.body',
    templateVars: {
      contract: contract.contractNumber,
      amount: contract.totalValue,
    },
    recipient: contract.customerId,
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: 'CONTRACT',
    channel: 'SMS',
    titleKey: 'notification.contract.active.title',
    messageKey: 'notification.contract.active.body',
    templateVars: {
      contract: contract.contractNumber,
      amount: contract.totalValue,
    },
    recipient: contract.customerPhone,
  });

  if (contract.customer?.whatsappPhone) {
    await createNotification({
      businessId,
      customerId: contract.customerId,
      contractId: contract.id,
      type: 'CONTRACT',
      channel: 'WHATSAPP',
      titleKey: 'notification.contract.active.title',
      messageKey: 'notification.contract.active.body',
      templateVars: {
        contract: contract.contractNumber,
        amount: contract.totalValue,
      },
      recipient: contract.customer.whatsappPhone,
    });
  }

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
      contractId: contract.id,
      type: 'CONTRACT',
      channel: 'IN_APP',
      titleKey: 'notification.contract.active.staff.title',
      messageKey: 'notification.contract.active.staff.body',
      templateVars: {
        customer: contract.customerName,
        amount: contract.totalValue,
      },
      recipient: u.id,
    });
  }

  return activated;
};

/* ================= READ ================= */

exports.getContracts = async ({ businessId, query = {} }) => {
  const { page = 1, limit = 10 } = query;

  const where = { businessId, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      include: {
        assets: true,

        schedules: {
          take: 10,
          orderBy: {
            dueDate: 'asc',
          },
        },

        _count: {
          select: {
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contract.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
    },
  };
};

exports.getContractById = async (id, businessId) => {
  const contract = await prisma.contract.findFirst({
    where: { id, businessId, deletedAt: null },
    include: {
      assets: true,

      schedules: {
        take: 10,
        orderBy: {
          dueDate: 'asc',
        },
      },

      _count: {
        select: {
          schedules: true,
        },
      },
    },
  });

  if (!contract) throw new Error('contract.not-found');

  return contract;
};

/* ================= UPDATE DRAFT================= */
exports.updateContractDraft = async (businessId, id, payload) => {
  const contract = await exports.getContractById(id, businessId);

  if (contract.status !== 'DRAFT') {
    throw new AppError('contract.edit_not_allowed', 400);
  }

  const forbiddenFields = [
    'id',
    'businessId',
    'contractNumber',
    'createdBy',
    'activatedAt',
    'paidAmount',
    'amendmentCount',
    'status',
    'deletedAt',
    'createdAt',
    'updatedAt',
  ];

  forbiddenFields.forEach((field) => {
    delete payload[field];
  });

  if (
    payload.totalValue !== undefined ||
    payload.downPayment !== undefined ||
    payload.installmentAmount !== undefined
  ) {
    const totalValue = payload.totalValue ?? contract.totalValue;

    const downPayment = payload.downPayment ?? contract.downPayment;

    const installmentAmount =
      payload.installmentAmount ?? contract.installmentAmount;

    const balance = totalValue - downPayment;

    payload.balance = balance;

    payload.outstandingAmount = balance;

    payload.totalInstallments = Math.ceil(balance / installmentAmount);
  }

  if (payload.startDate) {
    payload.startDate = new Date(payload.startDate);
  }

  if (payload.endDate) {
    payload.endDate = new Date(payload.endDate);
  }

  const updated = await prisma.contract.update({
    where: {
      id,
    },
    data: payload,
  });

  await logAudit({
    businessId,
    userId: payload?.userId || null,
    entityType: 'CONTRACT',
    entityId: id,
    action: 'CONTRACT_UPDATED',
  });

  return updated;
};

/* === TERMINATE CONTRACT === */
exports.terminateContract = async ({ businessId, id, userId, reason }) => {
  await subscriptionAuthority.assertActiveSubscription(businessId);

  const contract = await exports.getContractById(id, businessId);

  if (['TERMINATED', 'COMPLETED'].includes(contract.status)) {
    throw new AppError('contract.invalid_termination', 400);
  }

  return prisma.$transaction(async (tx) => {
    const existingPending = await tx.approvalRequest.findFirst({
      where: {
        businessId,
        entityType: 'CONTRACT',
        entityId: id,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new AppError('approval.already_pending', 400);
    }

    // 🔒 Enforce approval limit
    const approvalCount = await tx.approvalRequest.count({
      where: {
        businessId,
        status: 'PENDING',
      },
    });

    await subscriptionAuthority.assertLimit(
      businessId,
      'maxApprovalRequests',
      approvalCount,
    );

    const approval = await approvalEngine.createApproval({
      tx,
      businessId,
      entityType: 'CONTRACT',
      entityId: id,
      type: 'CONTRACT_TERMINATION',
      requestedBy: userId,
      reason,
    });

    await logAudit({
      tx,
      businessId,
      userId,
      entityType: 'CONTRACT',
      entityId: id,
      action: 'TERMINATION_REQUESTED',
    });

    return { approvalId: approval.id };
  });
};

/* ================= APPROVE TERMINATION (NEW) ================= */

exports.approveTermination = async ({ businessId, approvalId, approverId }) => {
  await subscriptionAuthority.assertActiveSubscription(businessId);

  // 🔒 Ensure approvals feature enabled
  await subscriptionAuthority.assertFeature(businessId, 'allowApprovals');

  // 🔒 Ensure contracts feature enabled
  await subscriptionAuthority.assertFeature(businessId, 'allowContracts');

  return prisma.$transaction(async (tx) => {
    const approval = await approvalEngine.approveApproval({
      tx,
      approvalId,
      businessId,
      approverId,
    });

    const contract = await tx.contract.findFirst({
      where: { id: approval.entityId },
    });

    if (!contract) throw new AppError('contract.not-found', 404);

    await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: 'TERMINATED',
        terminatedAt: new Date(),
        terminationReason: approval.reason,
        terminatedBy: approverId,
      },
    });

    await tx.customer.update({
      where: { id: contract.customerId },
      data: {
        activeContracts: { decrement: 1 },
        totalOutstanding: {
          decrement: contract.outstandingAmount,
        },
      },
    });

    await logAudit({
      tx,
      businessId,
      userId: approverId,
      entityType: 'CONTRACT',
      entityId: contract.id,
      action: 'TERMINATION_APPROVED',
    });

    return true;
  });
};

/* ================= REJECT TERMINATION (NEW) ================= */

exports.rejectTermination = async ({ businessId, approvalId, approverId }) => {
  await subscriptionAuthority.assertActiveSubscription(businessId);

  // 🔒 Ensure approvals feature enabled
  await subscriptionAuthority.assertFeature(businessId, 'allowApprovals');

  // 🔒 Ensure contracts feature enabled
  await subscriptionAuthority.assertFeature(businessId, 'allowContracts');

  return prisma.$transaction(async (tx) => {
    const approval = await approvalEngine.rejectApproval({
      tx,
      approvalId,
      businessId,
      approverId,
    });

    await logAudit({
      tx,
      businessId,
      userId: approverId,
      entityType: 'CONTRACT',
      entityId: approval.entityId,
      action: 'TERMINATION_REJECTED',
    });

    return true;
  });
};

/* ================= COMPLETE ================= */

exports.completeContract = async ({ businessId, id }) => {
  const contract = await exports.getContractById(id, businessId);

  if (contract.outstandingAmount > 0)
    throw new Error('contract.balance-not-zero');

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await tx.customer.update({
      where: { id: contract.customerId },
      data: {
        activeContracts: { decrement: 1 },
      },
    });
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: 'CONTRACT',
    channel: 'IN_APP',
    titleKey: 'notification.contract.completed.title',
    messageKey: 'notification.contract.completed.body',
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerId,
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: 'CONTRACT',
    channel: 'SMS',
    titleKey: 'notification.contract.completed.title',
    messageKey: 'notification.contract.completed.body',
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerPhone,
  });

  await logAudit({
    businessId,
    userId: contract.createdBy || null,
    entityType: 'CONTRACT',
    entityId: contract.id,
    action: 'CONTRACT_COMPLETED',
  });

  return true;
};

/* ================= SOFT DELETE ================= */

exports.deleteContract = async ({ businessId, id }) => {
  const contract = await exports.getContractById(id, businessId);

  const deleted = await prisma.$transaction(async (tx) => {
    if (contract.status === 'ACTIVE') {
      await tx.customer.update({
        where: { id: contract.customerId },
        data: {
          activeContracts: { decrement: 1 },
          totalOutstanding: { decrement: contract.outstandingAmount },
        },
      });
    }

    return tx.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });

  await logAudit({
    businessId,
    userId: contract.createdBy || null,
    entityType: 'CONTRACT',
    entityId: id,
    action: 'CONTRACT_DELETED',
  });

  return deleted;
};

/* ======================================================
   MODULE 8 PATCH — CUSTOMER PORTAL (READ ONLY)
   ADDED BELOW WITHOUT TOUCHING ABOVE CODE
   ====================================================== */

exports.getCustomerContracts = async ({ id }) => {
  const customerId = id;
  if (!customerId) {
    throw new AppError('auth.unauthorized', 401);
  }

  const contracts = await prisma.contract.findMany({
    where: { customerId },
    include: {
      assets: true,

      schedules: {
        take: 10,
        orderBy: {
          dueDate: 'asc',
        },
      },

      _count: {
        select: {
          schedules: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const payments = await prisma.installmentPayment.findMany({
    where: {
      customerId,
      status: 'POSTED',
    },
    select: {
      contractId: true,
      amount: true,
    },
  });

  const paymentsMap = {};
  for (const p of payments) {
    paymentsMap[p.contractId] = (paymentsMap[p.contractId] || 0) + p.amount;
  }

  return contracts.map((contract) => {
    const totalPaid = paymentsMap[contract.id] || 0;

    return {
      ...contract,
      totalPaid,
      outstandingAmount: contract.outstandingAmount,
      progress:
        contract.totalValue > 0
          ? Math.round((totalPaid / contract.totalValue) * 100)
          : 0,
    };
  });
};

exports.getCustomerContractById = async ({ contractId, customerId }) => {
  if (!customerId) {
    throw new AppError('auth.unauthorized', 401);
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerId,
    },
    include: {
      assets: true,

      schedules: {
        take: 10,
        orderBy: {
          dueDate: 'asc',
        },
      },

      _count: {
        select: {
          schedules: true,
        },
      },
    },
  });

  if (!contract) return null;

  const payments = await prisma.installmentPayment.findMany({
    where: {
      contractId,
      customerId,
      status: 'POSTED',
    },
    select: {
      amount: true,
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    ...contract,
    totalPaid,
    outstandingAmount: contract.outstandingAmount,
    progress:
      contract.totalValue > 0
        ? Math.round((totalPaid / contract.totalValue) * 100)
        : 0,
  };
};

exports.getCustomerContractForStatement = async (contractId, user) => {
  if (
    !user.id ||
    user.isBlacklisted ||
    user.status === 'INACTIVE' ||
    user.status === 'SUSPENDED'
  )
    return null;

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerId: user.id,
    },
  });

  if (!contract) return null;

  const payments = await prisma.installmentPayment.findMany({
    where: {
      contractId,
      customerId: user.customerId,
      status: 'POSTED',
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return {
    contract: {
      ...contract,
      totalPaid,
      outstandingAmount: contract.outstandingAmount,
    },
    payments,
  };
};

/* ==== LIST TERMINATION APPROVALS ===== */
exports.listTerminationApprovals = async ({ businessId, status }) => {
  const where = {
    businessId,
    entityType: 'CONTRACT',
    type: 'CONTRACT_TERMINATION',
  };

  if (status) where.status = status;

  return prisma.approvalRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
};

exports.amendContract = async (contractId, payload, user) => {
  const businessId = user.businessId;

  const { reason, changes } = payload;

  await subscriptionAuthority.assertActiveSubscription(businessId);

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      businessId,
      deletedAt: null,
    },
    include: {
      customer: true,
      schedules: {
        where: {
          status: {
            not: 'PAID',
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      },
    },
  });

  if (!contract) {
    throw new Error('contract.not_found');
  }

  if (contract.status !== 'ACTIVE') {
    throw new Error('contract.only_active_can_be_amended');
  }

  if (contract.amendmentCount >= 1) {
    throw new Error('contract.already_amended');
  }

  const auditChanges = {};

  Object.keys(changes).forEach((key) => {
    auditChanges[key] = {
      old: contract[key],
      new: changes[key],
    };
  });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedContract = await tx.contract.update({
      where: {
        id: contract.id,
      },
      data: {
        ...changes,
        amendmentCount: {
          increment: 1,
        },
        lastAmendedAt: new Date(),
      },
    });

    const affectsSchedules =
      changes.installmentAmount ||
      changes.totalInstallments ||
      changes.startDate ||
      changes.frequency ||
      changes.customDays;

    if (affectsSchedules) {
      await tx.installmentSchedule.deleteMany({
        where: {
          contractId: contract.id,
          status: {
            not: 'PAID',
          },
        },
      });

      const balanceRemaining = updatedContract.outstandingAmount;

      const installmentAmount =
        changes.installmentAmount || updatedContract.installmentAmount;

      const totalInstallments =
        changes.totalInstallments ||
        Math.ceil(balanceRemaining / installmentAmount);

      const dates = generateScheduleDates({
        startDate: changes.startDate || updatedContract.startDate,
        frequency: changes.frequency || updatedContract.frequency,
        customDays: changes.customDays || updatedContract.customDays,
        total: totalInstallments,
      });

      await tx.installmentSchedule.createMany({
        data: dates.map((d, index) => {
          const isLast = index === dates.length - 1;

          const amount = isLast
            ? balanceRemaining - installmentAmount * (dates.length - 1)
            : installmentAmount;

          return {
            contractId: contract.id,
            dueDate: d,
            amount,
          };
        }),
      });
    }

    await tx.contractAmendment.create({
      data: {
        businessId,
        contractId: contract.id,
        changedBy: user.id,
        reason,
        changes: auditChanges,
      },
    });

    return updatedContract;
  });

  await logAudit({
    businessId,
    userId: user.id,
    entityType: 'CONTRACT',
    entityId: contract.id,
    action: 'CONTRACT_AMENDED',
    metadata: {
      reason,
      changes: auditChanges,
    },
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: 'CONTRACT',
    channel: 'SMS',
    titleKey: 'notification.contract.amended.title',
    messageKey: 'notification.contract.amended.body',
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerPhone,
  });

  if (contract.customer?.whatsappPhone) {
    await createNotification({
      businessId,
      customerId: contract.customerId,
      contractId: contract.id,
      type: 'CONTRACT',
      channel: 'WHATSAPP',
      titleKey: 'notification.contract.amended.title',
      messageKey: 'notification.contract.amended.body',
      templateVars: {
        contract: contract.contractNumber,
      },
      recipient: contract.customer.whatsappPhone,
    });
  }

  return updated;
};

exports.getContractAmendments = async (businessId, contractId) => {
  await exports.getContractById(contractId, businessId);

  return prisma.contractAmendment.findMany({
    where: {
      businessId,
      contractId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

exports.getSingleContractAmendment = async (businessId, amendmentId) => {
  const amendment = await prisma.contractAmendment.findFirst({
    where: {
      id: amendmentId,
      businessId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!amendment) {
    throw new Error('contract.amendment_not_found');
  }

  return amendment;
};
