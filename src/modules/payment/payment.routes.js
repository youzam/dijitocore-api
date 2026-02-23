const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const subscriptionFeature = require("../../middlewares/subscriptionFeature.middleware");

const controller = require("./payment.controller");
const validation = require("./payment.validation");

router.use(auth);
router.use(tenant);

// ================= RECORD PAYMENT =================
router.post(
  "/",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  subscriptionFeature("allowPayments"),
  validate(validation.recordPayment),
  controller.recordPayment,
);

// ================= LIST PAYMENTS =================
router.get(
  "/",
  role(["BUSINESS_OWNER", "MANAGER"]),
  subscriptionFeature("allowPayments"),
  validate(validation.listPayments),
  controller.listPayments,
);

// ================= LIST REVERSALS =================
router.get(
  "/reversals",
  role(["BUSINESS_OWNER", "MANAGER"]),
  subscriptionFeature("allowPayments"),
  validate(validation.listReversals),
  controller.listReversals,
);

// ================= REQUEST REVERSAL =================
router.post(
  "/:id/reversal-request",
  role(["BUSINESS_OWNER", "MANAGER"]),
  subscriptionFeature("allowReversal"),
  validate(validation.requestReversal),
  controller.requestReversal,
);

// ================= APPROVE REVERSAL =================
router.post(
  "/approvals/:id/approve",
  role(["BUSINESS_OWNER"]),
  subscriptionFeature("allowReversal"),
  controller.approveReversal,
);

// ================= REJECT REVERSAL =================
router.post(
  "/approvals/:id/reject",
  role(["BUSINESS_OWNER"]),
  subscriptionFeature("allowReversal"),
  controller.rejectReversal,
);

/* =====================================================
   CUSTOMER PORTAL – MODULE 8 (READ ONLY)
   ===================================================== */

router.get(
  "/customer/my-payments",
  role(["CUSTOMER"]),
  subscriptionFeature("allowCustomerPortal"),
  controller.getMyPayments,
);

module.exports = router;
