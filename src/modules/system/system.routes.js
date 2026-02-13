const express = require("express");

const { bootstrapSystem } = require("./system.controller");
const bootstrapGuard = require("../../middlewares/bootstrap.middleware");

const incidentController = require("./system.incident.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");

const healthController = require("./system.health.controller");
const integrityController = require("./system.integrity.controller");

const monitorController = require("./system.monitor.controller");

const router = express.Router();

router.post("/bootstrap", bootstrapGuard, bootstrapSystem);

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN"]));

router.post("/incidents", incidentController.createIncident);
router.patch("/incidents/:id", incidentController.updateIncident);

router.get("/health", healthController.getHealth);
router.get("/integrity", integrityController.runChecks);

router.get("/jobs", monitorController.getJobs);
router.get("/errors", monitorController.getErrors);

module.exports = router;
