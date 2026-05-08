const ledgerCoreService = require('../../../services/ledger.service');

const { SCOPE_TYPES } = ledgerCoreService;

const formatLedgerEntry = (entry) => {
  return {
    id: entry.id,

    referenceId: entry.referenceId,
    referenceType: entry.referenceType,

    transactionType: entry.transactionType,

    scopeType: entry.scopeType,

    businessId: entry.businessId,

    businessName: entry.businessNameSnapshot,

    packageName: entry.packageNameSnapshot,

    country: entry.countrySnapshot,

    amount: Number(entry.amount),

    subscriptionAmount: entry.subscriptionAmount
      ? Number(entry.subscriptionAmount)
      : 0,

    setupFeeAmount: entry.setupFeeAmount ? Number(entry.setupFeeAmount) : 0,

    currency: entry.currency,

    accountType: entry.accountType,

    direction: entry.direction,

    status: entry.status,

    gateway: entry.gateway,

    retryCount: entry.retryCount,

    subscriptionId: entry.subscriptionId,

    packageId: entry.packageId,

    metadata: entry.metadata,

    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};

const getLedger = async (query) => {
  const {
    businessId,
    referenceType,
    status,
    gateway,
    packageId,
    subscriptionId,
    startDate,
    endDate,
    search,
    page,
    limit,
    orderBy,
    order,
  } = query;

  const result = await ledgerCoreService.getEntriesRaw({
    scopeType: SCOPE_TYPES.SYSTEM,

    businessId,
    referenceType,
    status,
    gateway,
    packageId,
    subscriptionId,
    startDate,
    endDate,
    search,

    page,
    limit,

    orderBy,
    order,
  });

  return {
    ...result,

    data: result.data.map(formatLedgerEntry),
  };
};

const getLedgerEntry = async ({ id }) => {
  const entry = await ledgerCoreService.getEntryById({
    id,
    scopeType: SCOPE_TYPES.SYSTEM,
  });

  if (!entry) {
    return null;
  }

  return formatLedgerEntry(entry);
};

const getLedgerDrilldown = async ({ id }) => {
  const entry = await ledgerCoreService.getLedgerDrilldown({
    id,
    scopeType: SCOPE_TYPES.SYSTEM,
  });

  if (!entry) {
    return null;
  }

  return {
    transaction: formatLedgerEntry(entry),

    financial: {
      amount: Number(entry.amount),

      subscriptionAmount: entry.subscriptionAmount
        ? Number(entry.subscriptionAmount)
        : 0,

      setupFeeAmount: entry.setupFeeAmount ? Number(entry.setupFeeAmount) : 0,

      currency: entry.currency,

      direction: entry.direction,

      accountType: entry.accountType,
    },

    business: {
      businessId: entry.businessId,

      businessName: entry.businessNameSnapshot,

      country: entry.countrySnapshot,
    },

    package: {
      packageId: entry.packageId,

      packageName: entry.packageNameSnapshot,
    },

    gateway: {
      gateway: entry.gateway,

      retryCount: entry.retryCount,
    },

    lifecycle: {
      status: entry.status,

      createdAt: entry.createdAt,

      updatedAt: entry.updatedAt,
    },

    audit: entry.metadata || {},
  };
};

const getLedgerBalance = async () => {
  const [systemCash, systemRevenue, systemRefund, systemAdjustment] =
    await Promise.all([
      ledgerCoreService.getBalance({
        scopeType: SCOPE_TYPES.SYSTEM,

        accountType: 'SYSTEM_CASH',
      }),

      ledgerCoreService.getBalance({
        scopeType: SCOPE_TYPES.SYSTEM,

        accountType: 'SYSTEM_REVENUE',
      }),

      ledgerCoreService.getBalance({
        scopeType: SCOPE_TYPES.SYSTEM,

        accountType: 'SYSTEM_REFUND',
      }),

      ledgerCoreService.getBalance({
        scopeType: SCOPE_TYPES.SYSTEM,

        accountType: 'SYSTEM_ADJUSTMENT',
      }),
    ]);

  return {
    systemCash,
    systemRevenue,
    systemRefund,
    systemAdjustment,
  };
};

const getLedgerAnalytics = async (query) => {
  const { businessId, startDate, endDate } = query;

  return ledgerCoreService.getAnalytics({
    scopeType: SCOPE_TYPES.SYSTEM,

    businessId,

    startDate,
    endDate,
  });
};

module.exports = {
  getLedger,

  getLedgerEntry,

  getLedgerDrilldown,

  getLedgerBalance,

  getLedgerAnalytics,
};
