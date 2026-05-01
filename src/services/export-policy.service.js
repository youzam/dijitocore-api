// src/services/export-policy.service.js

/**
 * EXPORT POLICY
 *
 * FULL → include all fields
 * PARTIAL → remove sensitive fields
 * NONE → exclude completely
 */

const EXPORT_POLICIES = {
  // Core
  user: "FULL",
  business: "FULL",
  customer: "FULL",
  contract: "FULL",

  // Financial
  installmentPayment: "PARTIAL",
  paymentReversal: "PARTIAL",
  financialAdjustment: "PARTIAL",

  // Logs
  auditLog: "PARTIAL",
  loginActivity: "PARTIAL",

  // Notifications
  notification: "PARTIAL",

  // System
  systemError: "NONE",
  systemJobLog: "NONE",
};

const DEFAULT_MODE = "PARTIAL";

const getExportMode = (model) => {
  return EXPORT_POLICIES[model] || DEFAULT_MODE;
};

module.exports = {
  getExportMode,
};
