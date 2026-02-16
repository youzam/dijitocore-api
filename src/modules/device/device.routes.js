const express = require("express");
const controller = require("./device.controller");
const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");

const router = express.Router();

router.use(auth);
router.use(tenant);

router.post("/register", controller.registerDevice);

module.exports = router;
