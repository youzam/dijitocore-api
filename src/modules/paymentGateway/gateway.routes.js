const express = require("express");
const router = express.Router();

const paymentGatewayController = require("./gateway.controller");

/*
|--------------------------------------------------------------------------
| Client Payment Gateways
|--------------------------------------------------------------------------
*/
router.get("/active", paymentGatewayController.getActivePaymentGateways);

module.exports = router;
