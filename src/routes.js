const express = require("express");

const { client } = require("./utils/metrics");
const authRoutes = require("./modules/auth/auth.routes");
const systemRoutes = require("./modules/system/system.routes");
const businessRoutes = require("./modules/business/business.routes");
const customerRoutes = require("./modules/customer/customer.routes");
const contractRoutes = require("./modules/contract/contract.routes");
const paymentRoutes = require("./modules/payment/payment.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const notificationRoutes = require("./modules/notification/notification.routes");
const deviceRoutes = require("./modules/device/device.routes");

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

router.use("/auth", authRoutes);
router.use("/system", systemRoutes);
router.use("/businesses", businessRoutes);
router.use("/customers", customerRoutes);
router.use("/contracts", contractRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboards", dashboardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/devices", deviceRoutes);

module.exports = router;
