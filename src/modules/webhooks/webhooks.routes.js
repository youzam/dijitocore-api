const express = require("express");
const router = express.Router();

const webhookController = require("./webhooks.controller");

const verifySignature = require("../../middlewares/paymentSignature.middleware");
const ipAllowlist = require("../../middlewares/webhookIpAllowlist.middleware");
const webhookRateLimit = require("../../middlewares/webhookRateLimit.middleware");

/* ===========================
   PAYMENT WEBHOOK
   =========================== */

router.post(
  "/payments",
  webhookRateLimit,
  ipAllowlist,
  verifySignature,
  webhookController.handlePaymentWebhook,
);

module.exports = router;
