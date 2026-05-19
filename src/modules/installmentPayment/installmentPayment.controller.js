const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const response = require('../../utils/response');

const paymentService = require('./installmentPayment.service');
const ledgerService = require('./ledger.service');

/* ===============================
   EXISTING CONTROLLERS (UNCHANGED)
   =============================== */

exports.recordPayment = catchAsync(async (req, res) => {
  if (req.files?.attachment) {
    req.body.attachment = req.files.attachment;
  }

  const payment = await paymentService.recordPayment({
    businessId: req.user.businessId,
    contractId: req.body.contractId,
    customerId: req.body.customerId,
    amount: Number(req.body.amount),
    channel: req.body.channel,
    source: req.body.source,
    reference: req.body.reference,
    idempotencyKey: req.body.idempotencyKey,
    attachment: req.files?.attachment || null,
    receivedAt: req.body.receivedAt,
    userId: req.user.id,
  });

  return response.success(req, res, payment, 201);
});

exports.listPayments = catchAsync(async (req, res) => {
  const result = await paymentService.listPayments(req);
  return response.success(req, res, result, 200);
});

exports.listReversals = catchAsync(async (req, res) => {
  const result = await paymentService.listReversals(req);
  return response.success(req, res, result, 200);
});

exports.requestReversal = catchAsync(async (req, res) => {
  const result = await paymentService.requestReversal({
    businessId: req.user.businessId,
    userId: req.user.id,
    paymentId: req.params.id,
    reason: req.body.reason,
    role: req.user.role,
  });

  return response.success(req, res, result, 200);
});

exports.approveReversal = catchAsync(async (req, res) => {
  const result = await paymentService.approveReversal({
    businessId: req.user.businessId,
    approverId: req.user.id,
    reversalId: req.params.id,
  });

  return response.success(req, res, result, 200);
});

exports.rejectReversal = catchAsync(async (req, res) => {
  const result = await paymentService.rejectReversal({
    businessId: req.user.businessId,
    userId: req.user.id,
    reversalId: req.params.id,
  });

  return response.success(req, res, result, 200, 'payment.reversal_rejected');
});

/* =====================================================
   CUSTOMER PORTAL – MODULE 8 (READ ONLY)
   ===================================================== */

exports.getMyPayments = catchAsync(async (req, res) => {
  if (req.user.isBlacklisted) {
    throw new AppError('customer.blacklisted', 403);
  }

  const payments = await paymentService.getCustomerPayments({
    customerId: req.user.customerId,
  });

  return response.success(
    req,
    res,
    payments,
    200,
    'payment.my_payments_fetched',
  );
});

/* =====================================================
   TENANT LEDGER
   ===================================================== */

exports.getLedger = catchAsync(async (req, res) => {
  const result = await ledgerService.getLedger({
    businessId: req.user.businessId,

    ...req.query,
  });

  return response.success(req, res, result, 200, 'ledger.fetched');
});

exports.getLedgerEntry = catchAsync(async (req, res) => {
  const result = await ledgerService.getLedgerEntry({
    id: req.params.id,

    businessId: req.user.businessId,
  });

  if (!result) {
    throw new AppError('ledger.not_found', 404);
  }

  return response.success(req, res, result, 200, 'ledger.entry_fetched');
});

exports.getLedgerDrilldown = catchAsync(async (req, res) => {
  const result = await ledgerService.getLedgerDrilldown({
    id: req.params.id,

    businessId: req.user.businessId,
  });

  if (!result) {
    throw new AppError('ledger.not_found', 404);
  }

  return response.success(req, res, result, 200, 'ledger.drilldown_fetched');
});

exports.getLedgerBalance = catchAsync(async (req, res) => {
  const result = await ledgerService.getLedgerBalance({
    businessId: req.user.businessId,
  });

  return response.success(req, res, result, 200, 'ledger.balance_fetched');
});

exports.getLedgerAnalytics = catchAsync(async (req, res) => {
  const result = await ledgerService.getLedgerAnalytics({
    businessId: req.user.businessId,

    ...req.query,
  });

  return response.success(req, res, result, 200, 'ledger.analytics_fetched');
});
