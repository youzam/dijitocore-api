const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");
const response = require("../../utils/response");

const paymentService = require("./payment.service");

/* ===============================
   EXISTING CONTROLLERS (UNCHANGED)
   =============================== */

exports.recordPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.recordPayment({
    businessId: req.user.businessId,
    userId: req.user.id,
    payload: req.body,
  });

  return response.success(req, res, payment, 201, "payment.recorded");
});

exports.listPayments = catchAsync(async (req, res) => {
  const result = await paymentService.listPayments(req);
  return response.success(req, res, result, 200, "payment.fetched");
});

exports.listReversals = catchAsync(async (req, res) => {
  const result = await paymentService.listReversals(req);
  return response.success(req, res, result, 200, "payment.reversals_fetched");
});

exports.requestReversal = catchAsync(async (req, res) => {
  const result = await paymentService.requestReversal({
    businessId: req.user.businessId,
    userId: req.user.id,
    paymentId: req.params.id,
    reason: req.body.reason,
  });

  return response.success(req, res, result, 200, "payment.reversal_requested");
});

exports.approveReversal = catchAsync(async (req, res) => {
  const result = await paymentService.approveReversal({
    businessId: req.user.businessId,
    userId: req.user.id,
    reversalId: req.params.id,
  });

  return response.success(req, res, result, 200, "payment.reversal_approved");
});

exports.rejectReversal = catchAsync(async (req, res) => {
  const result = await paymentService.rejectReversal({
    businessId: req.user.businessId,
    userId: req.user.id,
    reversalId: req.params.id,
  });

  return response.success(req, res, result, 200, "payment.reversal_rejected");
});

/* =====================================================
   CUSTOMER PORTAL – MODULE 8 (READ ONLY)
   ===================================================== */

exports.getMyPayments = catchAsync(async (req, res) => {
  if (req.user.isBlacklisted) {
    throw new AppError("customer.blacklisted", 403);
  }

  const payments = await paymentService.getCustomerPayments({
    customerId: req.user.customerId,
  });

  return response.success(
    req,
    res,
    payments,
    200,
    "payment.my_payments_fetched",
  );
});
