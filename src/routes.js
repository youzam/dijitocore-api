const express = require('express');

const { client } = require('./utils/metrics');
const authRoutes = require('./modules/auth/auth.routes');
const businessRoutes = require('./modules/business/business.routes');
const customerRoutes = require('./modules/customer/customer.routes');
const contractRoutes = require('./modules/contract/contract.routes');
const installmentPaymentRoutes = require('./modules/installmentPayment/installmentPayment.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const deviceRoutes = require('./modules/device/device.routes');
const subscriptionRoutes = require('./modules/subscription/subscription.routes');
const userRoutes = require('./modules/user/user.routes');
const announcementRoutes = require('./modules/announcement/announcement.routes');
const webhookRoutes = require('./modules/webhooks/webhooks.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const privacyRoutes = require('./modules/privacy/privacy.routes');
const ticketRoutes = require('./modules/ticket/ticket.routes');
const paymentGatewayRoutes = require('./modules/paymentGateway/gateway.routes');

// =========================
// ADMIN ROUTES (BACKOFFICE)
// =========================
const accessRoutes = require('./modules/admin/access/access.routes');
const governanceRoutes = require('./modules/admin/governance/governance.routes');
const commerceRoutes = require('./modules/admin/commerce/commerce.routes');
const securityRoutes = require('./modules/admin/security/security.routes');
const operationRoutes = require('./modules/admin/operation/operation.routes');
const settingRoutes = require('./modules/admin/setting/setting.routes');
const adminAnalyticsRoutes = require('./modules/admin/analytics/analytics.routes');
const adminCommunicationRoutes = require('./modules/admin/communication/communication.routes');
const adminComplianceRoutes = require('./modules/admin/compliance/compliance.routes');
const adminReportingRoutes = require('./modules/admin/reporting/reporting.routes');
const adminSupportRoutes = require('./modules/admin/support/support.routes');

const router = express.Router();

// =========================
// SYSTEM ENDPOINTS
// =========================

// Server health endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// =========================
// ADMIN ROUTES (INTERNAL / RBAC PROTECTED)
// =========================
router.use('/admin/access', accessRoutes);
router.use('/admin/governance', governanceRoutes);
router.use('/admin/commerce', commerceRoutes);
router.use('/admin/security', securityRoutes);
router.use('/admin/operations', operationRoutes);
router.use('/admin/settings', settingRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/admin/communication', adminCommunicationRoutes);
router.use('/admin/compliance', adminComplianceRoutes);
router.use('/admin/reporting', adminReportingRoutes);
router.use('/admin/support', adminSupportRoutes);

// =========================
// TENANT / PUBLIC ROUTES (BUSINESS & USER FACING)
// =========================
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/customers', customerRoutes);
router.use('/contracts', contractRoutes);
router.use('/installment-payments', installmentPaymentRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/devices', deviceRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/announcements', announcementRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/audit', auditRoutes);
router.use('/privacy', privacyRoutes);
router.use('/tickets', ticketRoutes);
router.use('/gateways', paymentGatewayRoutes);

module.exports = router;
