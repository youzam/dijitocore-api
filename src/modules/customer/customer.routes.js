const express = require("express");
const router = express.Router();

const validate = require("../../middlewares/validate.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");

const customerController = require("./customer.controller");
const customerValidation = require("./customer.validation");

router.post(
  "/",
  authMiddleware,
  roleMiddleware("BUSINESS_OWNER", "MANAGER", "STAFF"),
  validate(customerValidation.createCustomer),
  customerController.createCustomer,
);

module.exports = router;
