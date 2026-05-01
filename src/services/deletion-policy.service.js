// src/services/deletion-policy.service.js

/**
 * DELETION POLICY ENGINE (ALIGNED WITH DATA_GRAPH)
 *
 * Modes:
 * - HARD: fully delete record
 * - ANONYMIZE: remove sensitive fields, keep record
 * - RETAIN: do nothing
 */

const { SYSTEM_MODELS } = require("../config/data-graph");

const DEFAULT_MODE = "ANONYMIZE";

/**
 * Model-level deletion policies
 */
const MODEL_POLICIES = {
  // 🔑 ROOT ENTITIES
  user: "HARD",
  business: "HARD",
  customer: "HARD",

  // 🏢 BUSINESS LAYER
  businessSettings: "HARD",
  businessInvite: "HARD",
  approvalRequest: "ANONYMIZE",

  // 👥 CUSTOMER LAYER
  customerCredit: "HARD",
  customerImportLog: "HARD",

  // 📄 CONTRACT FLOW
  contract: "HARD",
  contractAsset: "HARD",
  installmentSchedule: "HARD",

  // 💰 FINANCIAL (NEVER HARD DELETE)
  installmentPayment: "ANONYMIZE",
  paymentReversal: "ANONYMIZE",
  financialAdjustment: "ANONYMIZE",
  subscriptionPayment: "ANONYMIZE",

  // 📦 SUBSCRIPTION
  subscription: "HARD",
  subscriptionHistory: "ANONYMIZE",
  subscriptionUsage: "ANONYMIZE",

  // 🔔 NOTIFICATIONS
  notification: "ANONYMIZE",
  notificationSetting: "HARD",

  // 🔐 AUTH / SECURITY (USER SIDE ONLY)
  refreshToken: "HARD",
  deviceToken: "HARD",
  loginActivity: "ANONYMIZE",
  consentLog: "ANONYMIZE",

  // 🎫 SUPPORT
  supportTicket: "ANONYMIZE",
  ticketMessage: "ANONYMIZE",
  ticketNote: "ANONYMIZE",
  ticketAttachment: "HARD",

  // 📊 DASHBOARD / ANALYTICS
  dashboardSnapshot: "ANONYMIZE",
  dashboardInsight: "ANONYMIZE",
  dashboardHealth: "ANONYMIZE",
  dashboardAssetMetric: "ANONYMIZE",
  dashboardStaffMetric: "ANONYMIZE",

  // 🎟️ BUSINESS OPERATIONS
  couponUsage: "ANONYMIZE",

  // 🧾 AUDIT / LOGS
  auditLog: "ANONYMIZE",

  // 📦 EXPORT STORAGE (USER DATA)
  dataExport: "HARD",
  dataExportStorage: "HARD",
};

/**
 * Resolve deletion mode for a model
 */
const getDeletionMode = (modelName) => {
  // 1. System models → always RETAIN
  if (SYSTEM_MODELS.includes(modelName)) {
    return "RETAIN";
  }

  // 2. Explicit policy
  if (MODEL_POLICIES[modelName]) {
    return MODEL_POLICIES[modelName];
  }

  // 3. Safe fallback
  return DEFAULT_MODE;
};

/**
 * Resolve base mode from request (future extension)
 */
const resolveBaseModeFromRequest = (request) => {
  if (!request) return DEFAULT_MODE;

  if (request.type === "ACCOUNT_DELETE") {
    return "HARD";
  }

  return DEFAULT_MODE;
};

module.exports = {
  getDeletionMode,
  resolveBaseModeFromRequest,
};
