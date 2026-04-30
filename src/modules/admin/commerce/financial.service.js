const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");
const { logAudit } = require("../../../utils/audit.helper");

/**
 * Refund Transaction (Enterprise)
 */
exports.refundTransaction = async (transactionId, actor) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: transactionId },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  // 🔥 ADD VALIDATION (NEW)
  if (payment.status === "REFUNDED") {
    throw new AppError("commerce.already_refunded", 400);
  }

  if (payment.status !== "CONFIRMED") {
    throw new AppError("commerce.invalid_refund_state", 400);
  }

  // 🔥 STEP 5: MARK PAYMENT AS REFUNDED
  await prisma.subscriptionPayment.update({
    where: { id: transactionId },
    data: {
      status: "REFUNDED",
    },
  });

  // 🔥 STEP 6: LOAD SUBSCRIPTION
  const subscription = await prisma.subscription.findUnique({
    where: { id: payment.subscriptionId },
  });

  if (!subscription) {
    throw new AppError("subscription.not_found", 404);
  }

  // 🔥 STEP 7: APPLY 2-DAY GRACE PERIOD
  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 2);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      graceUntil, // kutumia existing field
    },
  });

  await logAudit({
    userId: actor?.id || null,
    entityType: "PAYMENT",
    entityId: transactionId,
    action: "PAYMENT_REFUNDED",
    metadata: {
      subscriptionId: payment.subscriptionId,
      amount: payment.amount,
      previousStatus: payment.status,
      newStatus: "REFUNDED",
      graceUntil,
    },
    module: "COMMERCE",
    actorType: "ADMIN",
  });

  return {
    refunded: true,
    graceUntil,
  };
};

/**
 * Create Financial Adjustment (CREDIT / DEBIT)
 */
exports.createAdjustment = async (data, actor) => {
  const { businessId, amount, reason, type, createdBy } = data;

  // 🔥 REQUIRED FIELDS
  if (!businessId) {
    throw new AppError("commerce.business_required", 400);
  }

  if (!amount || Number(amount) === 0) {
    throw new AppError("commerce.invalid_amount", 400);
  }

  if (!reason) {
    throw new AppError("commerce.adjustment_reason_required", 400);
  }

  if (!type) {
    throw new AppError("commerce.adjustment_type_required", 400);
  }

  if (!createdBy) {
    throw new AppError("commerce.created_by_required", 400);
  }

  // 🔥 PRESERVE ORIGINAL DATA (NO FIELD LOSS)
  const adjustment = await prisma.financialAdjustment.create({
    data,
  });

  await logAudit({
    userId: actor?.id || null,
    entityType: "FINANCIAL_ADJUSTMENT",
    entityId: adjustment.id,
    action: "FINANCIAL_ADJUSTMENT_CREATED",
    metadata: {
      businessId,
      amount,
      type,
      reason,
    },
    module: "COMMERCE",
    actorType: "ADMIN",
  });

  return adjustment;
};

/**
 * Regenerate Invoice
 */
exports.regenerateInvoice = async (transactionId, actor) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: transactionId },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  // 🔥 ADD VALIDATION
  if (!transactionId) {
    throw new AppError("commerce.transaction_id_required", 400);
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

  await logAudit({
    userId: actor?.id || null,
    entityType: "PAYMENT",
    entityId: transactionId,
    action: "INVOICE_REGENERATED",
    metadata: {
      invoiceUrl: updated.invoiceUrl,
    },
    module: "COMMERCE",
    actorType: "ADMIN",
  });

  return {
    id: updated.id,
    invoiceUrl: updated.invoiceUrl,
  };
};
