const express = require("express");

const accessController = require("./access.controller");
const bootstrapMiddleware = require("../../../middlewares/bootstrap.middleware");

const router = express.Router();

router.post(
  "/bootstrap",
  bootstrapMiddleware,
  accessController.bootstrapSystem,
);

module.exports = router;
