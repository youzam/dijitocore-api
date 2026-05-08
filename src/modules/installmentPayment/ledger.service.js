const ledgerCoreService = require('../../services/ledger.service');

const { SCOPE_TYPES } = ledgerCoreService;

const formatLedgerEntry = (entry) => {
  return {
    id: entry.id,

    referenceId: entry.referenceId,
    referenceType: entry.referenceType,

    transactionType: entry.transactionType,

    scopeType: entry.scopeType,

    businessId: entry.businessId,

    customerId: entry.customerId,

    contractId: entry.contractId,

    businessName: entry.businessNameSnapshot,

    country: entry.countrySnapshot,

    amount: Number(entry.amount),

    currency: entry.currency,

    accountType: entry.accountType,

    direction: entry.direction,

    status: entry.status,

    metadata: entry.metadata,

    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};

const getLedger = async ({
  businessId,
  customerId,
  contractId,
  referenceType,
  status,
  startDate,
  endDate,
  search,
  page,
  limit,
  orderBy,
  order,
}) => {
  const result = await ledgerCoreService.getEntriesRaw({
    scopeType: SCOPE_TYPES.TENANT,

    businessId,

    customerId,

    contractId,

    referenceType,

    status,

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

const getLedgerEntry = async ({ id, businessId }) => {
  const entry = await ledgerCoreService.getEntryById({
    id,

    businessId,

    scopeType: SCOPE_TYPES.TENANT,
  });

  if (!entry) {
    return null;
  }

  return formatLedgerEntry(entry);
};

const getLedgerDrilldown = async ({ id, businessId }) => {
  const entry = await ledgerCoreService.getLedgerDrilldown({
    id,

    businessId,

    scopeType: SCOPE_TYPES.TENANT,
  });

  if (!entry) {
    return null;
  }

  return {
    transaction: formatLedgerEntry(entry),

    financial: {
      amount: Number(entry.amount),

      currency: entry.currency,

      direction: entry.direction,

      accountType: entry.accountType,
    },

    business: {
      businessId: entry.businessId,

      businessName: entry.businessNameSnapshot,

      country: entry.countrySnapshot,
    },

    customer: {
      customerId: entry.customerId,
    },

    contract: {
      contractId: entry.contractId,
    },

    lifecycle: {
      status: entry.status,

      createdAt: entry.createdAt,

      updatedAt: entry.updatedAt,
    },

    audit: entry.metadata || {},
  };
};

const getLedgerBalance = async ({ businessId }) => {
  const [tenantCash, tenantReceivable] = await Promise.all([
    ledgerCoreService.getBalance({
      scopeType: SCOPE_TYPES.TENANT,

      businessId,

      accountType: 'TENANT_CASH',
    }),

    ledgerCoreService.getBalance({
      scopeType: SCOPE_TYPES.TENANT,

      businessId,

      accountType: 'TENANT_RECEIVABLE',
    }),
  ]);

  return {
    tenantCash,
    tenantReceivable,
  };
};

const getLedgerAnalytics = async ({
  businessId,
  customerId,
  contractId,
  startDate,
  endDate,
}) => {
  return ledgerCoreService.getAnalytics({
    scopeType: SCOPE_TYPES.TENANT,

    businessId,

    customerId,

    contractId,

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
