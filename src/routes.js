const express = require("express");

const { client } = require("./utils/metrics");
const authRoutes = require("./modules/auth/auth.routes");
const businessRoutes = require("./modules/business/business.routes");
const customerRoutes = require("./modules/customer/customer.routes");
const contractRoutes = require("./modules/contract/contract.routes");
const paymentRoutes = require("./modules/installmentPayment/installmentPayment.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const notificationRoutes = require("./modules/notification/notification.routes");
const deviceRoutes = require("./modules/device/device.routes");
const subscriptionRoutes = require("./modules/subscription/subscription.routes");
const userRoutes = require("./modules/user/user.routes");
const announcementRoutes = require("./modules/announcement/announcement.routes");
const webhookRoutes = require("./modules/webhooks/webhooks.routes");
const auditRoutes = require("./modules/audit/audit.routes");
const privacyRoutes = require("./modules/privacy/privacy.routes");

const accessRoutes = require("./modules/admin/access/access.routes");
const governanceRoutes = require("./modules/admin/governance/governance.routes");
const commerceRoutes = require("./modules/admin/commerce/commerce.routes");
const securityRoutes = require("./modules/admin/security/security.routes");
const operationRoutes = require("./modules/admin/operation/operation.routes");
const settingRoutes = require("./modules/admin/setting/setting.routes");

const router = express.Router();

// Server health endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Metrix endpoint
router.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

router.use("/admin/access", accessRoutes);
router.use("/admin/governance", governanceRoutes);
router.use("/admin/commerce", commerceRoutes);
router.use("/admin/security", securityRoutes);
router.use("/admin/operations", operationRoutes);
router.use("/admin/settings", settingRoutes);

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/businesses", businessRoutes);
router.use("/customers", customerRoutes);
router.use("/contracts", contractRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboards", dashboardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/devices", deviceRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/announcements", announcementRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/audit", auditRoutes);
router.use("/privacy", privacyRoutes);

module.exports = router;
