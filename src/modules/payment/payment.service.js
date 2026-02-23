const prisma = require("../../config/prisma");
const factory = require("../../utils/handlerFactory");
const { logAudit } = require("../../utils/audit.helper");

const {
  createNotification,
} = require("../../services/notifications/notification.service");
const approvalEngine = require("../../services/approval/approval.engine");
const subscriptionAuthority = require("../subscription/subscription.authority.service");

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
  attachments,
  receivedAt,
  userId,
}) => {
  // 🔒 SUBSCRIPTION ENFORCEMENT (SAFE INJECTION)
  await subscriptionAuthority.assertActiveSubscription(businessId);
  await subscriptionAuthority.assertFeature(businessId, "allowPayments");

  const payment = await prisma.$transaction(async (tx) => {
    /* =====================================================
       IDEMPOTENCY CHECK
       ===================================================== */
    if (idempotencyKey) {
      const existing = await tx.payment.findFirst({
        where: { businessId, idempotencyKey },
      });
      if (existing) return existing;
    }

    /* =====================================================
       VALIDATE CUSTOMER
       ===================================================== */
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) throw new Error("customer.not_found");

    if (customer.status === "INACTIVE" || customer.isBlacklisted) {
      throw new Error("customer.inactiveBlacklisted");
    }

    /* =====================================================
       VALIDATE CONTRACT
       ===================================================== */
    const contract = await tx.contract.findFirst({
      where: { id: contractId, businessId },
      include: {
        schedules: true,
        business: {
          include: {
            users: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!contract) throw new Error("contract.not_found");

    if (contract.customerId !== customerId) {
      throw new Error("payment.customer_mismatch");
    }

    if (["TERMINATED", "COMPLETED"].includes(contract.status)) {
      throw new Error("contract.closed");
    }

    /* =====================================================
       CALCULATE PAYABLE
       ===================================================== */
    const payable = Math.min(amount, contract.outstandingAmount);
    let remaining = payable;

    const schedules = contract.schedules
      .filter((s) => s.status === "DUE")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    for (const s of schedules) {
      if (remaining < s.amount) break;

      await tx.installmentSchedule.update({
        where: { id: s.id },
        data: { status: "PAID", paidAt: new Date() },
      });

      remaining -= s.amount;
    }

    const newPaidAmount = contract.paidAmount + payable;
    const newOutstanding = Math.max(contract.totalValue - newPaidAmount, 0);

    await tx.contract.update({
      where: { id: contractId },
      data: {
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding,
        ...(newOutstanding === 0 && {
          completedAt: new Date(),
          status: "COMPLETED",
        }),
      },
    });

    /* =====================================================
       CREATE PAYMENT ENTRY (EXPLICIT STATUS)
       ===================================================== */
    return tx.payment.create({
      data: {
        businessId,
        contractId,
        customerId,
        amount: payable,
        channel,
        source,
        reference,
        idempotencyKey,
        attachments,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        balanceBefore: contract.outstandingAmount,
        balanceAfter: newOutstanding,
        recordedBy: userId,
        status: "POSTED",
      },
    });
  });

  /* =====================================================
     NOTIFICATIONS (UNCHANGED STRUCTURE)
     ===================================================== */

  await createNotification({
    businessId,
    customerId,
    contractId,
    type: "PAYMENT",
    channel: "SMS",
    titleKey: "notification.payment.title",
    messageKey: "notification.payment.body",
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
    type: "PAYMENT",
    channel: "IN_APP",
    titleKey: "notification.payment.title",
    messageKey: "notification.payment.body",
    templateVars: {
      amount: payment.amount,
      reference: payment.reference,
    },
    recipient: customerId,
  });

  const businessUsers = await prisma.user.findMany({
    where: {
      businessId,
      status: "ACTIVE",
    },
  });

  for (const u of businessUsers) {
    await createNotification({
      businessId,
      userId: u.id,
      contractId,
      type: "PAYMENT",
      channel: "IN_APP",
      titleKey: "notification.payment.staff.title",
      messageKey: "notification.payment.staff.body",
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
  await subscriptionAuthority.assertFeature(businessId, "allowReversal");
  await subscriptionAuthority.assertFeature(businessId, "allowApprovals");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, businessId },
    });

    if (!payment) throw new Error("payment.not_found");

    if (payment.status === "REVERSED") {
      throw new Error("payment.already_reversed");
    }

    const existingPending = await tx.approvalRequest.findFirst({
      where: {
        businessId,
        entityType: "PAYMENT",
        entityId: paymentId,
        status: "PENDING",
      },
    });

    if (existingPending) {
      throw new Error("approval.already_pending");
    }

    // 🔒 LIMIT ENFORCEMENT (SAFE INJECTION)
    const pendingApprovalsCount = await tx.approvalRequest.count({
      where: {
        businessId,
        status: "PENDING",
      },
    });

    await subscriptionAuthority.assertLimit(
      businessId,
      "maxApprovalRequests",
      pendingApprovalsCount,
    );

    // OWNER AUTO APPROVAL
    if (role === "BUSINESS_OWNER") {
      const reversal = await tx.paymentReversal.create({
        data: {
          paymentId,
          reason,
          requestedBy: userId,
          approvedBy: userId,
          approvedAt: new Date(),
          status: "APPROVED",
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
        entityType: "PAYMENT_REVERSAL",
        entityId: reversal.id,
        action: "REVERSAL_REQUESTED",
      });

      return { reversal, autoApproved: true };
    }

    const reversal = await tx.paymentReversal.create({
      data: {
        paymentId,
        reason,
        requestedBy: userId,
        status: "PENDING",
      },
    });

    const approval = await approvalEngine.createApproval({
      tx,
      businessId,
      entityType: "PAYMENT",
      entityId: reversal.id,
      type: "PAYMENT_REVERSAL",
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
  approvalId,
  approverId,
  internalPayment,
  internalReversal,
  tx,
}) => {
  return (tx || prisma).$transaction(async (trx) => {
    let reversal = internalReversal;
    let payment = internalPayment;

    if (!reversal) {
      const approval = await approvalEngine.approveApproval({
        tx: trx,
        approvalId,
        businessId,
        approverId,
      });

      reversal = await trx.paymentReversal.findFirst({
        where: { id: approval.entityId },
        include: { Payment: true },
      });

      if (!reversal) throw new Error("payment.reversal_not_found");

      payment = reversal.Payment;
    }

    if (payment.status === "REVERSED") {
      throw new Error("payment.already_reversed");
    }

    await logAudit({
      tx: trx,
      businessId,
      userId: approverId,
      entityType: "PAYMENT_REVERSAL",
      entityId: reversal.id,
      action: "REVERSAL_APPROVED",
    });

    const contract = await trx.contract.findFirst({
      where: { id: payment.contractId },
      include: { schedules: true },
    });

    if (!contract) throw new Error("contract.not_found");

    if (contract.completedAt) {
      throw new Error("contract.closed");
    }

    if (payment.amount <= 0) {
      throw new Error("payment.invalid_reversal_amount");
    }

    let rollback = payment.amount;

    const paidSchedules = contract.schedules
      .filter((s) => s.status === "PAID")
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    for (const s of paidSchedules) {
      if (rollback < s.amount) break;

      await trx.installmentSchedule.update({
        where: { id: s.id },
        data: { status: "DUE", paidAt: null },
      });

      rollback -= s.amount;
    }

    const newPaidAmount = Math.max(contract.paidAmount - payment.amount, 0);

    const newOutstanding = Math.min(
      contract.totalValue - newPaidAmount,
      contract.totalValue,
    );

    await trx.contract.update({
      where: { id: payment.contractId },
      data: {
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding,
        completedAt: null,
        status: "ACTIVE",
      },
    });

    await trx.payment.create({
      data: {
        businessId,
        contractId: payment.contractId,
        customerId: payment.customerId,
        amount: -payment.amount,
        channel: "REVERSAL",
        source: "SYSTEM",
        balanceBefore: payment.balanceAfter,
        balanceAfter: newOutstanding,
        recordedBy: approverId,
        receivedAt: new Date(),
        status: "POSTED",
      },
    });

    await trx.payment.update({
      where: { id: payment.id },
      data: { status: "REVERSED" },
    });

    await trx.paymentReversal.update({
      where: { id: reversal.id },
      data: {
        status: "APPROVED",
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    return true;
  });
};

/**
 * REJECT REVERSAL
 */
exports.rejectReversal = async ({ businessId, approvalId, approverId }) => {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.findFirst({
      where: { id: approvalId, businessId, status: "PENDING" },
    });

    if (!approval) throw new Error("payment.approval_not_found");

    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: "REJECTED",
        approvedBy: approverId,
        resolvedAt: new Date(),
      },
    });

    await tx.paymentReversal.update({
      where: { id: approval.entityId },
      data: { status: "REJECTED", approvedBy: approverId },
    });

    await logAudit({
      tx,
      businessId,
      userId: approverId,
      entityType: "PAYMENT_REVERSAL",
      entityId: approval.entityId,
      action: "REVERSAL_REJECTED",
    });

    return true;
  });
};

/**
 * LIST PAYMENTS (USING FACTORY)
 */
exports.listPayments = async (req) => {
  return factory.list({
    model: prisma.payment,
    query: req.query,
    businessFilter: { businessId: req.user.businessId },
    searchableFields: ["reference"],
    filterableFields: ["contractId", "customerId", "status"],
  });
};

/**
 * LIST REVERSALS (USING FACTORY)
 */
exports.listReversals = async (req) => {
  return factory.list({
    model: prisma.paymentReversal,
    query: req.query,
    businessFilter: {
      Payment: { businessId: req.user.businessId },
    },
    filterableFields: ["status"],
  });
};

exports.getCustomerPayments = async ({ customerId }) => {
  return prisma.payment.findMany({
    where: {
      customerId,
      status: "POSTED",
    },
    orderBy: { createdAt: "desc" },
  });
};
