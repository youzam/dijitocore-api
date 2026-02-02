const paymentService = require("./payment.service");
const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

/**
 * Record payment
 */
exports.recordPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.recordPayment({
    businessId: req.user.businessId,
    contractId: req.body.contractId,
    customerId: req.body.customerId,
    amount: req.body.amount,
    channel: req.body.channel,
    source: req.body.source,
    reference: req.body.reference,
    idempotencyKey: req.headers["x-idempotency-key"],
    attachments: req.body.attachments,
    receivedAt: req.body.receivedAt,
    userId: req.user.id,
  });

  return response.success(req, res, payment, 200, "payment.recorded");
});

/**
 * List payments
 */
exports.listPayments = catchAsync(async (req, res) => {
  const result = await paymentService.listPayments(
    req.user.businessId,
    req.query,
  );

  return response.success(req, res, result, 200);
});

/**
 * Request reversal
 */
exports.requestReversal = catchAsync(async (req, res) => {
  const result = await paymentService.requestReversal({
    businessId: req.user.businessId,
    paymentId: req.params.id,
    reason: req.body.reason,
    userId: req.user.id,
    role: req.user.role,
  });

  return response.success(req, res, result, 200, "payment.reversal_requested");
});

/**
 * Approve reversal
 */
exports.approveReversal = catchAsync(async (req, res) => {
  await paymentService.approveReversal({
    businessId: req.user.businessId,
    approvalId: req.params.id,
    approverId: req.user.id,
  });

  return response.success(req, res, null, 200, "payment.reversal_approved");
});

/**
 * Reject reversal
 */
exports.rejectReversal = catchAsync(async (req, res) => {
  await paymentService.rejectReversal({
    businessId: req.user.businessId,
    approvalId: req.params.id,
    approverId: req.user.id,
  });

  return response.success(req, res, null, 200, "payment.reversal_rejected");
});

/**
 * List reversals
 */
exports.listReversals = catchAsync(async (req, res) => {
  const result = await paymentService.listReversals(
    req.user.businessId,
    req.query,
  );

  return response.success(req, res, result, 200);
});
