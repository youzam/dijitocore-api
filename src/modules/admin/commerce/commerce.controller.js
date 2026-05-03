const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");
const { logAudit } = require("../../../utils/audit.helper");
const handlerFactory = require("../../../utils/handlerFactory");

// Services
const ledgerService = require("./ledger.service");
const financialService = require("./financial.service");
const couponService = require("./coupon.service");
const packageService = require("./package.service");
const subscriptionControlService = require("./subscription-control.service");

/**
 * =========================
 * TRANSACTIONS
 * =========================
 */

exports.getTransactions = catchAsync(async (req, res) => {
  const data = await ledgerService.getTransactions(req.query);

  return response.success(req, res, data, 200, "commerce.transactions_fetched");
});

exports.getTransaction = catchAsync(async (req, res) => {
  const data = await ledgerService.getTransactionById(req.params.id);

  return response.success(req, res, data, 200, "commerce.transaction_fetched");
});

exports.getTransactionDrilldown = catchAsync(async (req, res) => {
  const data = await ledgerService.getTransactionDrilldown(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "commerce.transaction_drilldown_fetched",
  );
});

/**
 * =========================
 * FINANCIAL
 * =========================
 */

exports.refundTransaction = catchAsync(async (req, res) => {
  const data = await financialService.refundTransaction(
    req.params.id,
    req.auth,
  );

  return response.success(req, res, data, 200, "commerce.refund_success");
});

exports.createAdjustment = catchAsync(async (req, res) => {
  const data = await financialService.createAdjustment(req.body, req.auth);

  return response.success(req, res, data, 201, "commerce.adjustment_created");
});

exports.regenerateInvoice = catchAsync(async (req, res) => {
  const data = await financialService.regenerateInvoice(
    req.params.id,
    req.auth,
  );

  return response.success(req, res, data, 200, "commerce.invoice_regenerated");
});

/**
 * =========================
 * COUPONS
 * =========================
 */

exports.createCoupon = catchAsync(async (req, res) => {
  const data = await couponService.createCoupon(req.body, req.auth);

  return response.success(req, res, data, 201, "commerce.coupon_created");
});

exports.getCoupons = handlerFactory.getAll("coupon");

exports.updateCoupon = catchAsync(async (req, res) => {
  const data = await couponService.updateCoupon(
    req.params.id,
    req.body,
    req.auth,
  );

  return response.success(req, res, data, 200, "commerce.coupon_updated");
});

/**
 * =========================
 * PACKAGES
 * =========================
 */

exports.createPackage = catchAsync(async (req, res) => {
  const data = await packageService.createPackage(req.body, req);

  return response.success(req, res, data, 201, "subscription.package_created");
});

exports.updatePackage = catchAsync(async (req, res) => {
  const data = await packageService.updatePackage(req.params.id, req.body, req);

  return response.success(req, res, data, 200, "subscription.package_updated");
});

exports.updatePackageConfiguration = catchAsync(async (req, res) => {
  const data = await packageService.updatePackageConfiguration(
    req.params.id,
    req.body,
    req,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "subscription.package_configuration_updated",
  );
});

exports.deactivatePackage = catchAsync(async (req, res) => {
  const data = await packageService.deactivatePackage(req.params.id, req);

  return response.success(
    req,
    res,
    data,
    200,
    "subscription.package_deactivated",
  );
});

exports.getPackages = handlerFactory.getAll("subscriptionPackage");

exports.getPackage = catchAsync(async (req, res) => {
  const data = await packageService.getPackageById(req.params.id);

  return response.success(req, res, data, 200, "subscription.package_fetched");
});

/**
 * =========================
 * SUBSCRIPTION CONTROL (NEW)
 * =========================
 */

exports.changeSubscriptionPlan = catchAsync(async (req, res) => {
  const data = await subscriptionControlService.changeSubscriptionPlan(
    req.params.id,
    req.body,
    req,
  );

  return response.success(req, res, data, 200, "commerce.subscription_changed");
});

exports.cancelSubscription = catchAsync(async (req, res) => {
  const data = await subscriptionControlService.cancelSubscription(
    req.params.id,
    req,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "commerce.subscription_cancelled",
  );
});

exports.extendSubscription = catchAsync(async (req, res) => {
  const data = await subscriptionControlService.extendSubscription(
    req.params.id,
    req.body,
    req,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "commerce.subscription_extended",
  );
});

exports.getGraceStatus = catchAsync(async (req, res) => {
  const data = await subscriptionControlService.getGraceStatus(req.params.id);

  return response.success(req, res, data, 200, "commerce.grace_status_fetched");
});

exports.extendGracePeriod = catchAsync(async (req, res) => {
  const data = await subscriptionControlService.extendGracePeriod(
    req.params.id,
    req.body,
    req,
  );

  return response.success(req, res, data, 200, "commerce.grace_extended");
});
