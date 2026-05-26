const express = require('express');
const router = express.Router();

const subscriptionController = require('./subscription.controller');
const subscriptionValidation = require('./subscription.validation');

const validate = require('../../middlewares/validate.middleware');
const auth = require('../../middlewares/auth.middleware');
const tenant = require('../../middlewares/tenant.middleware');
const role = require('../../middlewares/role.middleware');

/*
|--------------------------------------------------------------------------
| PUBLIC PACKAGES
|--------------------------------------------------------------------------
*/
router.get('/packages', subscriptionController.getActivePackages);

router.use(auth);

/* CREATE SUBSCRIPTION */
router.post(
  '/',
  role(['BUSINESS_OWNER']),
  validate(subscriptionValidation.createSubscription),
  subscriptionController.createSubscription,
);

/* UPGRADE SUBSCRIPTION */
router.post(
  '/:id/upgrade',

  role(['BUSINESS_OWNER']),
  tenant,
  validate(subscriptionValidation.upgradeSubscription),
  subscriptionController.upgradeSubscription,
);

/* INITIATE PAYMENT */
router.post(
  '/:id/pay',

  role(['BUSINESS_OWNER']),
  validate(subscriptionValidation.initiatePayment),
  subscriptionController.initiatePayment,
);

/* GET CURRENT SUBSCRIPTION */
router.get(
  '/current',

  role(['BUSINESS_OWNER', 'MANAGER']),
  tenant,
  subscriptionController.getCurrentSubscription,
);

/* CALCULATE PRICE */
router.post(
  '/:id/calculate-price',

  role(['BUSINESS_OWNER']),
  subscriptionController.calculatePrice,
);

/* APPLY COUPON */
router.post(
  '/:id/apply-coupon',

  role(['BUSINESS_OWNER']),
  validate(subscriptionValidation.applyCoupon),
  subscriptionController.applyCoupon,
);

module.exports = router;
