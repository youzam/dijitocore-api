const express = require('express');
const router = express.Router();

const paymentGatewayController = require('./gateway.controller');
const auth = require('../../middlewares/auth.middleware');

/*
|--------------------------------------------------------------------------
| Client Payment Gateways
|--------------------------------------------------------------------------
*/
router.use(auth);
router.get('/active', paymentGatewayController.getActivePaymentGateways);

module.exports = router;
