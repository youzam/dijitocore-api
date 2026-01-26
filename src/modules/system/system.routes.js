const express = require("express");
const { bootstrapSystem } = require("./system.controller");
const bootstrapGuard = require("../../middlewares/bootstrap.middleware");

const router = express.Router();

router.post("/bootstrap", bootstrapGuard, bootstrapSystem);

module.exports = router;
