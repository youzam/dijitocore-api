/**
 * Subscription Feature Registry
 * -----------------------------------
 * Single source of truth for:
 * - Allowed feature keys
 * - Allowed limit keys
 * - Type validation
 * - UI metadata
 *
 * IMPORTANT:
 * - Do NOT put business logic here
 * - Do NOT read DB here
 * - This file is configuration only
 *
 * NOTE:
 * - Core platform capabilities SHOULD NOT live here
 * - This registry should contain ONLY
 *   commercial/package entitlements
 */

const subscriptionFeatureRegistry = {
  /**
   * COMMERCIAL FEATURES
   * -----------------------------------
   * These features represent:
   * - upsells
   * - optional modules
   * - premium capabilities
   */

  features: {
    allowImportCustomers: {
      type: 'boolean',
      label: 'Allow Customers Import',
      category: 'advanced',

      description: 'Allows bulk import of customers via CSV or Excel.',
    },

    allowSMS: {
      type: 'boolean',
      label: 'Allow SMS',
      category: 'communication',

      description: 'Allows sending SMS notifications.',
    },

    allowCustomerPortal: {
      type: 'boolean',
      label: 'Allow Customer Portal',
      category: 'advanced',

      description: 'Allows customers to access their portal.',
    },

    allowMultiUser: {
      type: 'boolean',
      label: 'Allow Multi User',
      category: 'advanced',

      description: 'Allows adding multiple system users.',
    },

    allowAdvancedAnalytics: {
      type: 'boolean',
      label: 'Allow Advanced Analytics',
      category: 'advanced',

      description: 'Allows access to advanced analytics and reports.',
    },
  },

  /**
   * PACKAGE LIMITS
   */

  limits: {
    maxUsers: {
      type: 'number',

      label: 'Maximum Users',

      template: 'Up to {value} users',

      allowUnlimited: true,

      description: 'Maximum number of active users allowed.',
    },

    maxActiveContracts: {
      type: 'number',

      label: 'Maximum Active Contracts',

      template: 'Up to {value} active contracts',

      allowUnlimited: true,

      description: 'Maximum number of active contracts allowed.',
    },

    maxMonthlySms: {
      type: 'number',

      label: 'Maximum Monthly SMS',

      template: '{value} SMS per month',

      allowUnlimited: true,

      description: 'Maximum SMS messages allowed per month.',
    },
  },
};

/**
 * Helper functions
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
