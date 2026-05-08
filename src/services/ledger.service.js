const prisma = require('../config/prisma');

const SCOPE_TYPES = {
  SYSTEM: 'SYSTEM',
  TENANT: 'TENANT',
};

const DIRECTIONS = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

const STATUSES = {
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
};

const REFERENCE_TYPES = {
  SUBSCRIPTION_PAYMENT: 'SUBSCRIPTION_PAYMENT',
  SETUP_FEE: 'SETUP_FEE',
  SUBSCRIPTION_RENEWAL: 'SUBSCRIPTION_RENEWAL',
  SYSTEM_ADJUSTMENT: 'SYSTEM_ADJUSTMENT',
  SYSTEM_REFUND: 'SYSTEM_REFUND',

  CUSTOMER_INSTALLMENT_PAYMENT: 'CUSTOMER_INSTALLMENT_PAYMENT',
  CUSTOMER_WAIVER: 'CUSTOMER_WAIVER',
  CUSTOMER_REFUND: 'CUSTOMER_REFUND',
};

const ACCOUNT_TYPES = {
  SYSTEM_CASH: 'SYSTEM_CASH',
  SYSTEM_REVENUE: 'SYSTEM_REVENUE',
  SYSTEM_REFUND: 'SYSTEM_REFUND',
  SYSTEM_ADJUSTMENT: 'SYSTEM_ADJUSTMENT',

  TENANT_CASH: 'TENANT_CASH',
  TENANT_RECEIVABLE: 'TENANT_RECEIVABLE',
  TENANT_WAIVER: 'TENANT_WAIVER',
};

const SYSTEM_REFERENCE_TYPES = [
  REFERENCE_TYPES.SUBSCRIPTION_PAYMENT,
  REFERENCE_TYPES.SETUP_FEE,
  REFERENCE_TYPES.SUBSCRIPTION_RENEWAL,
  REFERENCE_TYPES.SYSTEM_ADJUSTMENT,
  REFERENCE_TYPES.SYSTEM_REFUND,
];

const TENANT_REFERENCE_TYPES = [
  REFERENCE_TYPES.CUSTOMER_INSTALLMENT_PAYMENT,
  REFERENCE_TYPES.CUSTOMER_WAIVER,
  REFERENCE_TYPES.CUSTOMER_REFUND,
];

const ALLOWED_SORT_FIELDS = ['createdAt', 'amount', 'status', 'gateway'];

const validateScope = ({ scopeType }) => {
  if (!Object.values(SCOPE_TYPES).includes(scopeType)) {
    throw new Error('Invalid ledger scope type');
  }
};

const validateReferenceType = ({ scopeType, referenceType }) => {
  if (
    scopeType === SCOPE_TYPES.SYSTEM &&
    !SYSTEM_REFERENCE_TYPES.includes(referenceType)
  ) {
    throw new Error('Invalid SYSTEM ledger reference type');
  }

  if (
    scopeType === SCOPE_TYPES.TENANT &&
    !TENANT_REFERENCE_TYPES.includes(referenceType)
  ) {
    throw new Error('Invalid TENANT ledger reference type');
  }
};

const validateDirection = (direction) => {
  if (!Object.values(DIRECTIONS).includes(direction)) {
    throw new Error('Invalid ledger direction');
  }
};

const validateAccountType = (accountType) => {
  if (!Object.values(ACCOUNT_TYPES).includes(accountType)) {
    throw new Error('Invalid ledger account type');
  }
};

const validateDoubleEntry = (entries) => {
  if (!Array.isArray(entries) || entries.length !== 2) {
    throw new Error('Ledger double entry must contain exactly 2 entries');
  }

  const debitCount = entries.filter(
    (entry) => entry.direction === DIRECTIONS.DEBIT,
  ).length;

  const creditCount = entries.filter(
    (entry) => entry.direction === DIRECTIONS.CREDIT,
  ).length;

  if (debitCount !== 1 || creditCount !== 1) {
    throw new Error(
      'Ledger double entry must contain one DEBIT and one CREDIT',
    );
  }
};

const normalizeLedgerStatus = (status) => {
  if (!status) {
    return STATUSES.POSTED;
  }

  if (!Object.values(STATUSES).includes(status)) {
    return STATUSES.POSTED;
  }

  return status;
};

const normalizePagination = ({ page = 1, limit = 20 }) => {
  const normalizedPage = Number(page) || 1;
  const normalizedLimit = Number(limit) || 20;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
};

const normalizeSorting = ({ orderBy = 'createdAt', order = 'desc' }) => {
  const safeOrderBy = ALLOWED_SORT_FIELDS.includes(orderBy)
    ? orderBy
    : 'createdAt';

  const safeOrder = order === 'asc' ? 'asc' : 'desc';

  return {
    orderBy: safeOrderBy,
    order: safeOrder,
  };
};

const buildSnapshots = ({ business, packageData }) => {
  return {
    businessNameSnapshot: business?.name || null,
    packageNameSnapshot: packageData?.name || null,
    countrySnapshot: business?.country || null,
  };
};

const buildWhereClause = ({
  scopeType,
  businessId,
  referenceType,
  status,
  gateway,
  packageId,
  subscriptionId,
  startDate,
  endDate,
  search,
}) => {
  const where = {
    scopeType,
  };

  if (businessId) {
    where.businessId = businessId;
  }

  if (referenceType) {
    where.referenceType = referenceType;
  }

  if (status) {
    where.status = status;
  }

  if (gateway) {
    where.gateway = gateway;
  }

  if (packageId) {
    where.packageId = packageId;
  }

  if (subscriptionId) {
    where.subscriptionId = subscriptionId;
  }

  if (startDate || endDate) {
    where.createdAt = {};

    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }

    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  if (search) {
    where.OR = [
      {
        referenceId: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        businessNameSnapshot: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        packageNameSnapshot: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  return where;
};

const recordEntryTx = async (tx, payload) => {
  const {
    scopeType,
    businessId,
    referenceId,
    referenceType,
    transactionType,
    accountType,
    direction,
    amount,
    currency,
    status,
    gateway,
    retryCount,
    subscriptionAmount,
    setupFeeAmount,
    subscriptionId,
    packageId,
    businessNameSnapshot,
    packageNameSnapshot,
    countrySnapshot,
    metadata,
  } = payload;

  validateScope({ scopeType });

  validateReferenceType({
    scopeType,
    referenceType,
  });

  validateDirection(direction);

  validateAccountType(accountType);

  return tx.ledgerEntry.create({
    data: {
      scopeType,
      businessId,
      referenceId,
      referenceType,
      transactionType,
      accountType,
      direction,
      amount,
      currency,
      status: normalizeLedgerStatus(status),
      gateway,
      retryCount,
      subscriptionAmount,
      setupFeeAmount,
      subscriptionId,
      packageId,
      businessNameSnapshot,
      packageNameSnapshot,
      countrySnapshot,
      metadata,
    },
  });
};

const recordEntry = async (payload) => {
  return prisma.$transaction(async (tx) => {
    return recordEntryTx(tx, payload);
  });
};

const recordDoubleEntryTx = async (tx, payload) => {
  const { entries, amount, currency } = payload;

  validateDoubleEntry(entries);

  const results = [];

  for (const entry of entries) {
    const created = await recordEntryTx(tx, {
      ...payload,
      accountType: entry.accountType,
      direction: entry.direction,
      amount,
      currency,
    });

    results.push(created);
  }

  return results;
};

const recordDoubleEntry = async (payload) => {
  return prisma.$transaction(async (tx) => {
    return recordDoubleEntryTx(tx, payload);
  });
};

const reverseEntry = async ({ entryId, metadata }) => {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ledgerEntry.findUnique({
      where: {
        id: entryId,
      },
    });

    if (!original) {
      throw new Error('Ledger entry not found for reversal');
    }

    const reversedDirection =
      original.direction === DIRECTIONS.DEBIT
        ? DIRECTIONS.CREDIT
        : DIRECTIONS.DEBIT;

    const reversed = await tx.ledgerEntry.create({
      data: {
        scopeType: original.scopeType,
        businessId: original.businessId,
        referenceId: original.referenceId,
        referenceType: original.referenceType,
        transactionType: original.transactionType,
        accountType: original.accountType,
        direction: reversedDirection,
        amount: original.amount,
        currency: original.currency,
        status: STATUSES.REVERSED,
        gateway: original.gateway,
        retryCount: original.retryCount,
        subscriptionAmount: original.subscriptionAmount,
        setupFeeAmount: original.setupFeeAmount,
        subscriptionId: original.subscriptionId,
        packageId: original.packageId,
        businessNameSnapshot: original.businessNameSnapshot,
        packageNameSnapshot: original.packageNameSnapshot,
        countrySnapshot: original.countrySnapshot,
        metadata: {
          reversedFrom: original.id,
          ...metadata,
        },
      },
    });

    return reversed;
  });
};

const getEntriesRaw = async ({
  scopeType,
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
}) => {
  validateScope({ scopeType });

  const pagination = normalizePagination({
    page,
    limit,
  });

  const sorting = normalizeSorting({
    orderBy,
    order,
  });

  const where = buildWhereClause({
    scopeType,
    businessId,
    referenceType,
    status,
    gateway,
    packageId,
    subscriptionId,
    startDate,
    endDate,
    search,
  });

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: {
        [sorting.orderBy]: sorting.order,
      },
      skip: pagination.skip,
      take: pagination.limit,
    }),

    prisma.ledgerEntry.count({
      where,
    }),
  ]);

  return {
    data: entries,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const getEntryById = async ({ id, scopeType, businessId }) => {
  validateScope({ scopeType });

  return prisma.ledgerEntry.findFirst({
    where: {
      id,
      scopeType,
      ...(businessId
        ? {
            businessId,
          }
        : {}),
    },
  });
};

const getLedgerDrilldown = async ({ id, scopeType, businessId }) => {
  validateScope({ scopeType });

  return prisma.ledgerEntry.findFirst({
    where: {
      id,
      scopeType,
      ...(businessId
        ? {
            businessId,
          }
        : {}),
    },
  });
};

const getBalance = async ({ scopeType, businessId, accountType }) => {
  validateScope({ scopeType });

  validateAccountType(accountType);

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      scopeType,
      businessId,
      accountType,
      status: STATUSES.POSTED,
    },

    select: {
      amount: true,
      direction: true,
    },
  });

  let balance = 0;

  for (const entry of entries) {
    if (entry.direction === DIRECTIONS.DEBIT) {
      balance += Number(entry.amount);
    } else {
      balance -= Number(entry.amount);
    }
  }

  return {
    accountType,
    balance,
  };
};

const getAnalytics = async ({ scopeType, businessId, startDate, endDate }) => {
  validateScope({ scopeType });

  const where = buildWhereClause({
    scopeType,
    businessId,
    startDate,
    endDate,
  });

  const entries = await prisma.ledgerEntry.findMany({
    where,
    select: {
      amount: true,
      direction: true,
      referenceType: true,
    },
  });

  let debitTotal = 0;
  let creditTotal = 0;

  const breakdown = {};

  for (const entry of entries) {
    const amount = Number(entry.amount);

    if (entry.direction === DIRECTIONS.DEBIT) {
      debitTotal += amount;
    } else {
      creditTotal += amount;
    }

    if (!breakdown[entry.referenceType]) {
      breakdown[entry.referenceType] = 0;
    }

    breakdown[entry.referenceType] += amount;
  }

  return {
    totalEntries: entries.length,
    debitTotal,
    creditTotal,
    netBalance: debitTotal - creditTotal,
    breakdown,
  };
};

module.exports = {
  SCOPE_TYPES,
  DIRECTIONS,
  STATUSES,
  REFERENCE_TYPES,
  ACCOUNT_TYPES,

  recordEntry,
  recordEntryTx,

  recordDoubleEntry,
  recordDoubleEntryTx,

  reverseEntry,

  getEntriesRaw,
  getEntryById,
  getLedgerDrilldown,
  getBalance,
  getAnalytics,

  buildSnapshots,
  buildWhereClause,
};
