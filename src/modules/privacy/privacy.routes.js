const express = require("express");
const router = express.Router();

const controller = require("./privacy.controller");
const auth = require("../../middlewares/auth.middleware");

router.post("/requests", auth, controller.createDataRequest);
router.get("/requests", auth, controller.getMyDataRequests);
router.get("/requests/:id", auth, controller.getMyDataRequestById);

router.post("/consents", auth, controller.createConsent);
router.patch("/consents", auth, controller.updateConsent);
router.get("/consents", auth, controller.getMyConsents);
router.get("/data-requests/:id/download", auth, controller.downloadExport);

module.exports = router;
