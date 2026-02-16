const catchAsync = require("../../utils/catchAsync");
const { success } = require("../../utils/response");
const subscriptionService = require("./subscription.service");
const paymentService = require("./subscription.payment.service");
const prisma = require("../../config/prisma");

/* ===========================
   BUSINESS OPERATIONS
=========================== */

exports.createSubscription = catchAsync(async (req, res) => {
  const subscription = await subscriptionService.createSubscription({
    businessId: req.user.businessId,
    packageId: req.body.packageId,
    billingCycle: req.body.billingCycle,
    userId: req.user.id,
  });

  return success(req, res, subscription, 201, "subscription.created");
});

exports.getCurrentSubscription = catchAsync(async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      businessId: req.user.businessId,
      status: {
        in: ["TRIAL", "ACTIVE", "GRACE"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(req, res, subscription, 200, "subscription.fetched");
});

exports.upgradeSubscription = catchAsync(async (req, res) => {
  const updated = await subscriptionService.upgradeSubscription({
    businessId: req.user.businessId,
    subscriptionId: req.params.id,
    packageId: req.body.packageId,
    billingCycle: req.body.billingCycle,
    userId: req.user.id,
  });

  return success(req, res, updated, 200, "subscription.upgraded");
});

/* ===========================
   PACKAGE (SYSTEM LEVEL)
=========================== */

exports.getPackages = catchAsync(async (req, res) => {
  const packages = await prisma.subscriptionPackage.findMany({
    where: {
      isActive: req.query.isActive ? req.query.isActive === "true" : undefined,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return success(req, res, packages, 200, "subscription.fetched");
});

exports.createPackage = catchAsync(async (req, res) => {
  const pkg = await subscriptionService.createPackage(req.body, req.user.id);

  return success(req, res, pkg, 201, "subscription.package_created");
});

exports.updatePackage = catchAsync(async (req, res) => {
  const pkg = await subscriptionService.updatePackage(
    req.params.id,
    req.body,
    req.user.id,
  );

  return success(req, res, pkg, 200, "subscription.package_updated");
});

/* ===========================
   PAYMENT OPERATIONS
=========================== */

exports.initiatePayment = catchAsync(async (req, res) => {
  const gatewayResponse = await paymentService.initiatePayment({
    businessId: req.user.businessId,
    subscriptionId: req.params.id,
    userId: req.user.id,
  });

  return success(
    req,
    res,
    gatewayResponse,
    200,
    "subscription.payment_initiated",
  );
});

exports.manualConfirmPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.adminManualConfirm({
    paymentId: req.params.id,
    userId: req.user.id,
  });

  return success(req, res, payment, 200, "subscription.payment_confirmed");
});

exports.reconcilePayment = catchAsync(async (req, res) => {
  const payment = await paymentService.reconcilePayment({
    paymentId: req.params.id,
    userId: req.user.id,
  });

  return success(req, res, payment, 200, "payment.reconciled");
});

exports.getAllPayments = catchAsync(async (req, res) => {
  const payments = await prisma.subscriptionPayment.findMany({
    orderBy: { createdAt: "desc" },
  });

  return success(req, res, payments, 200, "payment.list_success");
});
