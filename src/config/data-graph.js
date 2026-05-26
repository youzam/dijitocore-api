// src/config/data-graph.js

/**
 * DATA OWNERSHIP GRAPH
 *
 * Defines how data flows from root actors:
 * - user (business owner / normal user)
 * - customer
 * - admin (system-level, mostly retained)
 *
 * This graph is used to:
 * 1. Build deletion scope (all related IDs)
 * 2. Ensure no orphan data remains
 * 3. Support multi-tenant safe deletion
 */

const DATA_GRAPH = {
  // 🔑 ROOT: USER (business owner / platform user)
  user: [
    { model: 'business', foreignKey: 'ownerId' },
    { model: 'refreshToken', foreignKey: 'userId' },
    { model: 'deviceToken', foreignKey: 'userId' },
    { model: 'loginActivity', foreignKey: 'userId' },
    { model: 'notification', foreignKey: 'userId' },
    { model: 'notificationSetting', foreignKey: 'userId' },
    { model: 'consentLog', foreignKey: 'customerId' },
  ],

  // 🏢 BUSINESS (owned by user)
  business: [
    { model: 'customer', foreignKey: 'businessId' },
    { model: 'businessSettings', foreignKey: 'businessId' },
    { model: 'businessInvite', foreignKey: 'businessId' },
    { model: 'approvalRequest', foreignKey: 'businessId' },
    { model: 'dashboardSnapshot', foreignKey: 'businessId' },
    { model: 'dashboardInsight', foreignKey: 'businessId' },
    { model: 'dashboardHealth', foreignKey: 'businessId' },
    { model: 'dashboardAssetMetric', foreignKey: 'businessId' },
    { model: 'dashboardStaffMetric', foreignKey: 'businessId' },
    { model: 'notification', foreignKey: 'businessId' },
    { model: 'subscription', foreignKey: 'businessId' },
    { model: 'financialAdjustment', foreignKey: 'businessId' },
    { model: 'couponUsage', foreignKey: 'businessId' },
    { model: 'auditLog', foreignKey: 'businessId' },
    { model: 'ledgerEntry', foreignKey: 'businessId' },
  ],

  // 👥 CUSTOMER (belongs to business)
  customer: [
    { model: 'contract', foreignKey: 'customerId' },

    { model: 'customerCredit', foreignKey: 'customerId' },
    { model: 'customerImportLog', foreignKey: 'customerId' },
    { model: 'notification', foreignKey: 'customerId' },
    { model: 'contractAsset', foreignKey: 'contractId' },
  ],

  // 📄 CONTRACT
  contract: [
    { model: 'installmentSchedule', foreignKey: 'contractId' },
    { model: 'contractAmendment', foreignKey: 'contractId' },
  ],

  // 📆 INSTALLMENT SCHEDULE
  installmentSchedule: [
    { model: 'installmentPayment', foreignKey: 'scheduleId' },
  ],

  // 💰 PAYMENTS (financial chain)
  installmentPayment: [{ model: 'paymentReversal', foreignKey: 'paymentId' }],

  // 🧾 SUBSCRIPTION (business-level SaaS billing)
  businessSubscription: [
    { model: 'subscriptionHistory', foreignKey: 'subscriptionId' },
    { model: 'subscriptionPayment', foreignKey: 'subscriptionId' },
    { model: 'subscriptionUsage', foreignKey: 'subscriptionId' },
  ],

  // 🎫 SUPPORT SYSTEM
  supportTicket: [
    { model: 'ticketMessage', foreignKey: 'ticketId' },
    { model: 'ticketNote', foreignKey: 'ticketId' },
    { model: 'ticketAttachment', foreignKey: 'ticketId' },
  ],

  // 📦 EXPORTS (critical GDPR data)
  dataExport: [{ model: 'dataExportStorage', foreignKey: 'exportId' }],
};

/**
 * ROOT MODELS (entry points for scope building)
 */
const ROOT_MODELS = {
  USER: 'user',
  CUSTOMER: 'customer',
  ADMIN: 'systemAdmin', // mostly retained, limited deletion
};

/**
 * MODELS THAT SHOULD NEVER BE TRAVERSED / DELETED
 */
const SYSTEM_MODELS = [
  // system core
  'systemSetting',
  'systemError',
  'systemErrorGroup',
  'systemHealthSnapshot',
  'systemJobLog',
  'systemSeedLog',

  // infra
  'jobLock',
  'deadJob',

  // compliance infra
  'dataRequest',
  'dataRetentionPolicy',
  'policyVersion',
  'purgeQueue',

  // auth & roles
  'permission',
  'rolePermission',
  'systemAdminRole',
  'adminSession',
  'adminImpersonation',

  // operation
  'coupon',

  // admin root
  'systemAdmin',

  // export history
  'reportExport',

  // configs
  'notificationTemplate',
  'notificationEscalationRule',
  'bulkNotificationLimit',
  'apiMetric',
  'gatewayHealth',

  // package config
  'subscriptionPackage',

  // security
  'securityIncident',
  'suspiciousActivity',
  'fraudFlag',

  // Terms and privcy policies versioning
  'legalPolicyDocument',

  '_prisma_migrations',
];

/**
 * HELPER: Get children of a model
 */
const getChildren = (model) => {
  return DATA_GRAPH[model] || [];
};

/**
 * HELPER: Check if model is system-protected
 */
const isSystemModel = (model) => {
  return SYSTEM_MODELS.includes(model);
};

module.exports = {
  DATA_GRAPH,
  ROOT_MODELS,
  SYSTEM_MODELS,
  getChildren,
  isSystemModel,
};
