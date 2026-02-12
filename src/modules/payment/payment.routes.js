const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const controller = require("./payment.controller");
const validation = require("./payment.validation");

// Record payment (Staff+)
router.post(
  "/",
  auth,
  tenant,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  validate(validation.recordPayment),
  controller.recordPayment,
);

// List payments
router.get(
  "/",
  auth,
  tenant,
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validation.listPayments),
  controller.listPayments,
);

// List reversals
router.get(
  "/reversals",
  auth,
  tenant,
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validation.listReversals),
  controller.listReversals,
);

// Request reversal
router.post(
  "/:id/reversal-request",
  auth,
  tenant,
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validation.requestReversal),
  controller.requestReversal,
);

// Approve reversal (BUSINESS_OWNER only)
router.post(
  "/approvals/:id/approve",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.approveReversal,
);

// Reject reversal (BUSINESS_OWNER only)
router.post(
  "/approvals/:id/reject",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  controller.rejectReversal,
);

/* =====================================================
   CUSTOMER PORTAL – MODULE 8 (READ ONLY)
   ===================================================== */

router.get(
  "/customer/my-payments",
  auth,
  role(["CUSTOMER"]),
  controller.getMyPayments,
);

module.exports = router;
