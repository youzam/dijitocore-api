const express = require("express");
const router = express.Router();

const auth = require("../../middlewares/auth.middleware");
const role = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const controller = require("./customer.controller");
const validator = require("./customer.validation");

router.use(auth);

// Create customer
router.post(
  "/",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  validate(validator.createCustomer),
  controller.createCustomer,
);

// List + search + filter + pagination
router.get(
  "/",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.listCustomers,
);

// Get single customer
router.get(
  "/:id",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.getCustomer,
);

// Update customer
router.put(
  "/:id",
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validator.updateCustomer),
  controller.updateCustomer,
);

// Update status
router.patch(
  "/:id/status",
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validator.updateStatus),
  controller.updateStatus,
);

// Blacklist toggle
router.patch(
  "/:id/blacklist",
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(validator.updateBlacklist),
  controller.updateBlacklist,
);

// Import customers (CSV / Excel)
router.post(
  "/import",
  role(["BUSINESS_OWNER", "MANAGER"]),
  controller.importCustomers,
);

module.exports = router;
