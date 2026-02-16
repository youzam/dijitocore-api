const express = require("express");

const systemController = require("./system.controller");
const bootstrapGuard = require("../../middlewares/bootstrap.middleware");

const validate = require("../../middlewares/validate.middleware");
const incidentController = require("./system.incident.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");

const healthController = require("./system.health.controller");
const integrityController = require("./system.integrity.controller");

const monitorController = require("./system.monitor.controller");
const gatewayController = require("./system.gateway.controller");
const gatewayValidation = require("./system.gateway.validation");

const router = express.Router();

router.post("/bootstrap", bootstrapGuard, systemController.bootstrapSystem);

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN"]));

router.post("/incidents", incidentController.createIncident);
router.patch("/incidents/:id", incidentController.updateIncident);

router.get("/health", healthController.getHealth);
router.get("/integrity", integrityController.runChecks);

router.get("/jobs", monitorController.getJobs);
router.get("/errors", monitorController.getErrors);

/* GET ACTIVE GATEWAY */
router.get("/gateway", gatewayController.getActiveGateway);

/* UPDATE ACTIVE GATEWAY */
router.patch(
  "/gateway",
  validate(gatewayValidation.updateGateway),
  gatewayController.updateActiveGateway,
);

router.patch(
  "/payment-gateway",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  systemController.updateActiveGateway,
);

module.exports = router;
