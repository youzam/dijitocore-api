const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * Refund Transaction (Enterprise)
 */
exports.refundTransaction = async (transactionId, req) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: transactionId },
    include: {
      subscription: true,
    },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  if (payment.status === "REFUNDED") {
    throw new AppError("commerce.transaction_already_refunded", 400);
  }

  // Update original transaction
  const updated = await prisma.subscriptionPayment.update({
    where: { id: transactionId },
    data: {
      status: "REFUNDED",
      adminOverride: true,
      metadata: {
        ...(payment.metadata || {}),
        refund: {
          refundedBy: req.user.id,
          refundedAt: new Date(),
        },
      },
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    adminOverride: updated.adminOverride,
  };
};

/**
 * Create Financial Adjustment (CREDIT / DEBIT)
 */
exports.createAdjustment = async (data, req) => {
  const { businessId, amount, type, reason } = data;

  if (!businessId || !amount || !type) {
    throw new AppError("commerce.invalid_adjustment_data", 400);
  }

  if (!["CREDIT", "DEBIT"].includes(type)) {
    throw new AppError("commerce.invalid_adjustment_type", 400);
  }

  // Create adjustment record
  const adjustment = await prisma.financialAdjustment.create({
    data: {
      businessId,
      amount,
      type,
      reason: reason || null,
      createdBy: req.user.id,
    },
  });

  return {
    id: adjustment.id,
    businessId: adjustment.businessId,
    amount: adjustment.amount,
    type: adjustment.type,
    createdAt: adjustment.createdAt,
  };
};

/**
 * Credit Allocation (Special Adjustment)
 */
exports.allocateCredit = async (data, req) => {
  const { businessId, amount, reason } = data;

  if (!businessId || !amount) {
    throw new AppError("commerce.invalid_credit_data", 400);
  }

  const credit = await prisma.financialAdjustment.create({
    data: {
      businessId,
      amount,
      type: "CREDIT",
      reason: reason || "Admin credit allocation",
      createdBy: req.user.id,
    },
  });

  return {
    id: credit.id,
    businessId: credit.businessId,
    amount: credit.amount,
    type: credit.type,
    createdAt: credit.createdAt,
  };
};

/**
 * Regenerate Invoice
 */
exports.regenerateInvoice = async (transactionId) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: transactionId },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  // Simulate invoice regeneration (can be replaced with real service)
  const newInvoiceUrl = `https://invoices.dijitotrack.com/${payment.id}`;

  const updated = await prisma.subscriptionPayment.update({
    where: { id: transactionId },
    data: {
      invoiceUrl: newInvoiceUrl,
      adminOverride: true,
      metadata: {
        ...(payment.metadata || {}),
        invoiceRegeneratedAt: new Date(),
      },
    },
  });

  return {
    id: updated.id,
    invoiceUrl: updated.invoiceUrl,
  };
};
