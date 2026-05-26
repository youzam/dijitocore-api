/**
 * Subscription Feature Registry
 * -----------------------------------
 * Single source of truth for:
 * - Allowed package feature keys
 * - Allowed package limit keys
 * - Type validation
 * - UI metadata
 *
 * IMPORTANT:
 * - Core package values are stored in SubscriptionPackage.features + limits.
 * - features = boolean availability.
 * - limits = numeric quota/capacity. null means unlimited.
 */

const subscriptionFeatureRegistry = {
  features: {
    hasCustomerManagement: {
      type: 'boolean',
      label: 'Customer Management',
      category: 'core',
      description:
        'Manage customer profiles, contacts, records, and histories.',
    },

    hasInstallmentPayments: {
      type: 'boolean',
      label: 'Installment Payments',
      category: 'core',
      description:
        'Record and monitor payments made against installment contracts.',
    },

    hasCustomerPortal: {
      type: 'boolean',
      label: 'Customer Portal',
      category: 'core',
      description: 'Allow customers to view balances, schedules, and progress.',
    },

    hasBasicAnalytics: {
      type: 'boolean',
      label: 'Basic Analytics',
      category: 'analytics',
      description:
        'View essential summaries for contracts, payments, and customers.',
    },

    hasAdvancedAnalytics: {
      type: 'boolean',
      label: 'Advanced Analytics',
      category: 'analytics',
      description:
        'Access deeper operational insights and business performance views.',
    },

    hasSmsNotification: {
      type: 'boolean',
      label: 'SMS Notifications',
      category: 'communication',
      description: 'Send SMS reminders and alerts to customers.',
    },

    hasWhatsappNotification: {
      type: 'boolean',
      label: 'WhatsApp Notifications',
      category: 'communication',
      description:
        'Send important customer and business notifications via WhatsApp.',
    },

    hasCustomerImport: {
      type: 'boolean',
      label: 'Import Customers',
      category: 'advanced',
      description: 'Bulk import customer records using Excel or CSV files.',
    },

    hasAuditLogs: {
      type: 'boolean',
      label: 'Activity Logs & Audit Trail',
      category: 'governance',
      description: 'Track important system actions and operational activities.',
    },

    hasSupportTickets: {
      type: 'boolean',
      label: 'Support Tickets',
      category: 'support',
      description: 'Create and manage support requests inside the platform.',
    },

    hasPrioritySupport: {
      type: 'boolean',
      label: 'Priority Support',
      category: 'support',
      description:
        'Get faster assistance for operational and technical issues.',
    },

    hasMultiBranches: {
      type: 'boolean',
      label: 'Multi-Branch Support',
      category: 'operations',
      description: 'Manage multiple branches from one centralized workspace.',
    },

    hasMultiUsers: {
      type: 'boolean',
      label: 'Multi-User Access',
      category: 'operations',
      description: 'Allow multiple team members to access the workspace.',
    },
  },

  limits: {
    maxBranches: {
      type: 'number',
      label: 'Branches',
      template: '{value} branches',
      allowUnlimited: true,
      description: 'Number of business branches supported by the plan.',
    },

    maxUsers: {
      type: 'number',
      label: 'System Users',
      template: '{value} users',
      allowUnlimited: true,
      description:
        'Number of active team members who can access the workspace.',
    },

    maxContracts: {
      type: 'number',
      label: 'Installment Contracts',
      template: '{value} contracts',
      allowUnlimited: true,
      description: 'Create and manage customer installment agreements.',
    },

    maxMonthlySms: {
      type: 'number',
      label: 'SMS Notifications',
      template: '{value} / month',
      allowUnlimited: true,
      description: 'Included monthly SMS quota for reminders and alerts.',
    },
  },
};

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

subscriptionFeatureRegistry.getFeatureLabels = () => {
  return Object.fromEntries(
    Object.entries(subscriptionFeatureRegistry.features).map(([key, value]) => [
      key,
      value.label,
    ]),
  );
};

subscriptionFeatureRegistry.getLimitLabels = () => {
  return Object.fromEntries(
    Object.entries(subscriptionFeatureRegistry.limits).map(([key, value]) => [
      key,
      value.template,
    ]),
  );
};

subscriptionFeatureRegistry.getFeatureMeta = () => {
  return subscriptionFeatureRegistry.features;
};

subscriptionFeatureRegistry.getLimitMeta = () => {
  return subscriptionFeatureRegistry.limits;
};

module.exports = subscriptionFeatureRegistry;
