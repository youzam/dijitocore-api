const express = require("express");
const router = express.Router();

const controller = require("./announcement.controller");
const auth = require("../../middlewares/auth.middleware");

router.get("/", auth, controller.getUserAnnouncements);

router.post("/:id/read", auth, controller.markAsRead);

router.post("/:id/dismiss", auth, controller.dismissAnnouncement);

module.exports = router;
