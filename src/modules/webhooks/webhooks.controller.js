const selcomGateway = require("../../utils/paymentGateway/selcom.gateway");
const paymentService = require("../subscription/subscription.payment.service");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");

/**
 * =====================================================
 * PAYMENT WEBHOOK CONTROLLER
 * Supports: SELCOM, MPESA, AIRTEL
 * =====================================================
 */
exports.handlePaymentWebhook = catchAsync(async (req, res) => {
  const now = Date.now();
  const timestamp = Number(req.headers["x-timestamp"]);

  if (timestamp && Math.abs(now - timestamp) > 5 * 60 * 1000) {
    throw new AppError("payment.webhook_expired", 403);
  }

  const provider = req.headers["x-provider"];

  if (!provider) {
    throw new AppError("payment.provider_missing", 400);
  }

  switch (provider) {
    case "SELCOM":
      return handleSelcom(req, res);

    case "MPESA":
      return handleMpesa(req, res);

    case "AIRTEL":
      return handleAirtel(req, res);

    default:
      throw new AppError("payment.invalid_gateway", 400);
  }
});

/**
 * ===============================
 * SELCOM
 * ===============================
 */
const handleSelcom = async (req, res) => {
  const signature = req.headers["x-checksum"];

  const isValid = selcomGateway.verifyWebhook(req.body, signature);

  if (!isValid) {
    throw new AppError("payment.invalid_signature", 403);
  }

  const { order_id, amount, transaction_id, status } = req.body;

  if (status !== "SUCCESS") {
    return res.status(200).json({});
  }

  await paymentService.processGatewayWebhook({
    reference: order_id,
    externalTransactionId: transaction_id,
    amount: Number(amount),
    payloadHash: signature,
  });

  return res.status(200).json({});
};

/**
 * ===============================
 * MPESA
 * ===============================
 */
const handleMpesa = async (req, res) => {
  const callback = req.body?.Body?.stkCallback;

  if (!callback) {
    throw new AppError("payment.invalid_payload", 400);
  }

  if (callback.ResultCode !== 0) {
    return res.status(200).json({});
  }

  const metadata = callback.CallbackMetadata?.Item || [];

  const getValue = (name) => {
    const item = metadata.find((i) => i.Name === name);
    return item ? item.Value : null;
  };

  const reference = callback.AccountReference;
  const amount = Number(getValue("Amount"));
  const transactionId = getValue("MpesaReceiptNumber");

  await paymentService.processGatewayWebhook({
    reference,
    externalTransactionId: transactionId,
    amount,
    payloadHash: transactionId,
  });

  return res.status(200).json({});
};

/**
 * ===============================
 * AIRTEL
 * ===============================
 */
const handleAirtel = async (req, res) => {
  const body = req.body;

  if (!body || body.status !== "SUCCESS") {
    return res.status(200).json({});
  }

  const reference = body.transaction?.id;
  const amount = Number(body.transaction?.amount);
  const transactionId = body.transaction?.airtel_txn_id;

  await paymentService.processGatewayWebhook({
    reference,
    externalTransactionId: transactionId,
    amount,
    payloadHash: transactionId,
  });

  return res.status(200).json({});
};
