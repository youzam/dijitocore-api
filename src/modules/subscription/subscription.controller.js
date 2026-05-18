const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/response');
const subscriptionService = require('./subscription.service');
const paymentService = require('./subscription.payment.service');
const prisma = require('../../config/prisma');
const registry = require('../../utils/subscriptionFeatureRegistry');
const AppError = require('../../utils/AppError');

/* ===========================
   BUSINESS OPERATIONS
=========================== */
exports.calculatePrice = catchAsync(async (req, res) => {
  const result = await subscriptionService.calculatePrice({
    businessId: req.user.businessId,
    subscriptionId: req.params.id,
  });

  return success(req, res, result, 200, 'subscription.price_calculated');
});

exports.applyCoupon = catchAsync(async (req, res) => {
  const result = await subscriptionService.applyCouponToSubscription({
    businessId: req.user.businessId,
    subscriptionId: req.params.id,
    couponCode: req.body.couponCode,
  });

  return success(req, res, result, 200, 'subscription.coupon_applied');
});

exports.createSubscription = catchAsync(async (req, res) => {
  const subscription = await subscriptionService.createSubscription({
    businessId: req.user.businessId,
    packageId: req.body.packageId,
    billingCycle: req.body.billingCycle,
    paymentMethod: req.body.paymentMethod,
    phone: req.body.phone,
    couponId: req.body.couponId,
    userId: req.user.id,
  });

  return success(req, res, subscription, 201, 'subscription.created');
});

exports.getCurrentSubscription = catchAsync(async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      businessId: req.user.businessId,
      status: {
        in: ['ACTIVE', 'GRACE'],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return success(req, res, subscription, 200, 'subscription.fetched');
});

exports.upgradeSubscription = catchAsync(async (req, res) => {
  const updated = await subscriptionService.upgradeSubscription({
    businessId: req.user.businessId,
    subscriptionId: req.params.id,
    packageId: req.body.packageId,
    billingCycle: req.body.billingCycle,
    userId: req.user.id,
  });

  return success(req, res, updated, 200, 'subscription.upgraded');
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
    'subscription.payment_initiated',
  );
});

/* ===========================
   SUBSCRIPTION PACKAGE ADMIN
=========================== */
exports.getPackageSchema = catchAsync(async (req, res) => {
  const pkg = await prisma.subscriptionPackage.findUnique({
    where: { id: req.params.id },
  });

  if (!pkg) {
    throw new AppError('subscription.package_not_found', 404);
  }

  return success(
    req,
    res,
    {
      registry,
      package: pkg,
    },
    200,
    'subscription.package_schema_fetched',
  );
});

exports.getActivePackages = catchAsync(async (req, res) => {
  const data = await subscriptionService.getActivePackages();

  return success(req, res, data, 200, 'subscription.packages_fetched');
});
