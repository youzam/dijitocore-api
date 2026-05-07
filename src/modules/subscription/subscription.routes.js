const express = require('express');
const router = express.Router();

const subscriptionController = require('./subscription.controller');
const subscriptionValidation = require('./subscription.validation');

const validate = require('../../middlewares/validate.middleware');
const auth = require('../../middlewares/auth.middleware');
const tenant = require('../../middlewares/tenant.middleware');
const role = require('../../middlewares/role.middleware');

/* ===========================
   BUSINESS ROUTES
   =========================== */

/* CREATE SUBSCRIPTION */
router.post(
  '/',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(subscriptionValidation.createSubscription),
  subscriptionController.createSubscription,
);

/* UPGRADE SUBSCRIPTION */
router.post(
  '/:id/upgrade',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(subscriptionValidation.upgradeSubscription),
  subscriptionController.upgradeSubscription,
);

/* INITIATE PAYMENT */
router.post(
  '/:id/pay',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(subscriptionValidation.initiatePayment),
  subscriptionController.initiatePayment,
);

/* GET CURRENT SUBSCRIPTION */
router.get(
  '/current',
  auth,
  role(['BUSINESS_OWNER', 'MANAGER']),
  tenant,
  subscriptionController.getCurrentSubscription,
);

/*
|--------------------------------------------------------------------------
| PUBLIC PACKAGES
|--------------------------------------------------------------------------
*/
router.get('/packages', subscriptionController.getActivePackages);

/* CALCULATE PRICE */
router.post(
  '/:id/calculate-price',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  subscriptionController.calculatePrice,
);

/* APPLY COUPON */
router.post(
  '/:id/apply-coupon',
  auth,
  role(['BUSINESS_OWNER']),
  tenant,
  validate(subscriptionValidation.applyCoupon),
  subscriptionController.applyCoupon,
);

module.exports = router;
