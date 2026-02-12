const express = require("express");
const controller = require("./notification.controller");
const notSettingcontroller = require("./notification-settings.controller");
const notAnalyticController = require("./notification-analytics.controller");
const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * All notification routes require auth + tenant
 */
router.use(auth);
router.use(tenant);

/**
 * Get notifications inbox
 * (business users + customers)
 */
router.get("/", controller.getNotifications);

/**
 * Mark notification as read
 */
router.post("/read", controller.markAsRead);

/**
 * Notification Settings
 */
router.get("/settings", notSettingcontroller.getSettings);
router.patch("/settings", notSettingcontroller.updateSettings);

/**
 * Notification Analytics
 */
router.get("/analytics", notAnalyticController.getAnalytics);
/**
 * Bulk notifications
 * Only BUSINESS_OWNER / MANAGER / STAFF
 */
router.post(
  "/bulk",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  controller.bulkNotify,
);

module.exports = router;
