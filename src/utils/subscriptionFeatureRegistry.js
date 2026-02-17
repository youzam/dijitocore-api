/**
 * Subscription Feature Registry
 * -----------------------------------
 * This is the single source of truth for:
 * - Allowed feature keys
 * - Allowed limit keys
 * - Type validation
 * - UI metadata
 *
 * IMPORTANT:
 * - Do NOT put business logic here
 * - Do NOT read DB here
 * - This file is configuration only
 */

const subscriptionFeatureRegistry = {
  features: {
    allowContracts: {
      type: "boolean",
      label: "Allow Contracts",
      category: "core",
      description: "Allows creation and management of contracts.",
    },
    allowImportCustomers: {
      type: "boolean",
      label: "Allow Customers Import",
      category: "advanced",
      description: "Allows bulk import of customers via CSV or Excel.",
    },

    allowPayments: {
      type: "boolean",
      label: "Allow Payments",
      category: "core",
      description: "Allows recording and processing of payments.",
    },

    allowDashboard: {
      type: "boolean",
      label: "Allow Dashboard",
      category: "core",
      description: "Allows access to business dashboard.",
    },

    allowSMS: {
      type: "boolean",
      label: "Allow SMS",
      category: "communication",
      description: "Allows sending SMS notifications.",
    },

    allowCustomerPortal: {
      type: "boolean",
      label: "Allow Customer Portal",
      category: "advanced",
      description: "Allows customers to access their portal.",
    },

    allowReversal: {
      type: "boolean",
      label: "Allow Reversal",
      category: "advanced",
      description: "Allows payment reversals.",
    },

    allowApprovals: {
      type: "boolean",
      label: "Allow Approvals",
      category: "advanced",
      description: "Enables approval workflow.",
    },

    allowMultiUser: {
      type: "boolean",
      label: "Allow Multi User",
      category: "advanced",
      description: "Allows adding multiple system users.",
    },

    allowAdvancedAnalytics: {
      type: "boolean",
      label: "Allow Advanced Analytics",
      category: "advanced",
      description: "Allows access to advanced analytics and reports.",
    },
  },

  limits: {
    maxUsers: {
      type: "number",
      label: "Maximum Users",
      allowUnlimited: true,
      description: "Maximum number of active users allowed.",
    },

    maxActiveContracts: {
      type: "number",
      label: "Maximum Active Contracts",
      allowUnlimited: true,
      description: "Maximum number of active contracts allowed.",
    },

    maxApprovalRequests: {
      type: "number",
      label: "Maximum Approval Requests",
      allowUnlimited: true,
      description: "Maximum number of approval requests allowed.",
    },

    maxMonthlySms: {
      type: "number",
      label: "Maximum Monthly SMS",
      allowUnlimited: true,
      description: "Maximum SMS messages allowed per month.",
    },
  },
};

/**
 * Helper functions (pure config helpers)
 */

subscriptionFeatureRegistry.isValidFeatureKey = (key) => {
  return Object.prototype.hasOwnProperty.call(
    subscriptionFeatureRegistry.features,
    key,
  );
};

subscriptionFeatureRegistry.isValidLimitKey = (key) => {
  return Object.prototype.hasOwnProperty.call(
    subscriptionFeatureRegistry.limits,
    key,
  );
};

subscriptionFeatureRegistry.getFeatureKeys = () => {
  return Object.keys(subscriptionFeatureRegistry.features);
};

subscriptionFeatureRegistry.getLimitKeys = () => {
  return Object.keys(subscriptionFeatureRegistry.limits);
};

module.exports = subscriptionFeatureRegistry;
