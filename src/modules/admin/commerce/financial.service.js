const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * Refund Transaction (Enterprise)
 */
exports.refundTransaction = async (transactionId, data) => {
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
  const updatedPayment = await prisma.subscriptionPayment.update({
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

  return {
    refunded: true,
    graceUntil,
  };
};

/**
 * Create Financial Adjustment (CREDIT / DEBIT)
 */
exports.createAdjustment = async (data) => {
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
  return prisma.financialAdjustment.create({
    data,
  });
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

  return {
    id: updated.id,
    invoiceUrl: updated.invoiceUrl,
  };
};
