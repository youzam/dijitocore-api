const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * Normalize transaction type
 */
const normalizeTransactionType = (type) => {
  const allowed = [
    "SUBSCRIPTION",
    "SETUP_FEE",
    "RENEWAL",
    "REFUND",
    "MANUAL_ADJUSTMENT",
  ];

  return allowed.includes(type) ? type : "SUBSCRIPTION";
};

/**
 * Build filters (UPDATED — FULL)
 */
const buildWhereClause = (filters) => {
  const {
    businessId,
    status,
    type,
    gateway,
    startDate,
    endDate,
    packageId,
    country,
  } = filters;

  return {
    ...(status && { status }),
    ...(type && { type }),
    ...(gateway && { gateway }),

    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),

    ...(businessId && {
      subscription: {
        businessId,
      },
    }),

    ...(packageId && {
      subscription: {
        packageId,
      },
    }),

    ...(country && {
      subscription: {
        business: {
          country,
        },
      },
    }),
  };
};

/**
 * GET TRANSACTIONS (UPDATED — FULL ENTERPRISE)
 */
exports.getTransactions = async (query) => {
  const { page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = query;

  const skip = (Number(page) - 1) * Number(limit);

  const where = buildWhereClause(query);

  // 🔥 FETCH PAYMENTS
  const [paymentCount, payments, adjustments] = await Promise.all([
    prisma.subscriptionPayment.count({ where }),

    prisma.subscriptionPayment.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: {
        [sortBy]: order,
      },
      include: {
        subscription: {
          include: {
            business: true,
            package: true,
          },
        },
      },
    }),

    // 🔥 INCLUDE ADJUSTMENTS (NEW)
    prisma.financialAdjustment.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  /**
   * 🔥 MAP PAYMENTS
   */
  const paymentTransactions = payments.map((payment) => ({
    id: payment.id,

    businessId: payment.subscription.businessId,
    businessName: payment.subscription.business?.name || null,
    country: payment.subscription.business?.country || null,

    packageId: payment.subscription.packageId,
    packageName: payment.subscription.package?.name || null,

    // 🔥 AMOUNT BREAKDOWN
    subscriptionAmount: payment.type === "SUBSCRIPTION" ? payment.amount : null,

    setupFeeAmount: payment.type === "SETUP_FEE" ? payment.amount : null,

    amount: payment.amount,
    currency: payment.currency,

    type: normalizeTransactionType(payment.type),
    status: payment.status,

    gateway: payment.gateway || null,

    invoiceUrl: payment.invoiceUrl || null,
    webhookStatus: payment.webhookStatus || null,
    adminOverride: payment.adminOverride,

    paidAt: payment.paidAt,
    createdAt: payment.createdAt,

    // 🔥 ADD ATTEMPT COUNT
    retryCount: payment.retryCount || 0,

    // 🔥 AUDIT LINK FLAG
    hasAuditLog: !!payment.metadata,
  }));

  /**
   * 🔥 MAP ADJUSTMENTS (NEW)
   */
  const adjustmentTransactions = adjustments.map((adj) => ({
    id: adj.id,

    businessId: adj.businessId,
    businessName: null,
    country: null,

    packageId: null,
    packageName: null,

    subscriptionAmount: null,
    setupFeeAmount: null,

    amount: adj.amount,
    currency: null,

    type: "MANUAL_ADJUSTMENT",
    status: "SUCCESS",

    gateway: null,

    invoiceUrl: null,
    webhookStatus: null,
    adminOverride: true,

    paidAt: adj.createdAt,
    createdAt: adj.createdAt,

    retryCount: 0,
    hasAuditLog: false,
  }));

  /**
   * 🔥 MERGE + SORT
   */
  const allTransactions = [...paymentTransactions, ...adjustmentTransactions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + Number(limit));

  return {
    data: allTransactions,
    meta: {
      total: paymentCount + adjustments.length,
      page: Number(page),
      limit: Number(limit),
    },
  };
};

/**
 * 🔥 DRILLDOWN (UPDATED)
 */
exports.getTransactionDrilldown = async (id) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  return {
    id: payment.id,

    gatewayPayload: payment.gatewayPayload || null,
    retryCount: payment.retryCount || 0,

    webhookStatus: payment.webhookStatus,

    metadata: payment.metadata || null,

    // 🔥 FUTURE AUDIT HOOK
    auditLogs: [], // placeholder until audit module linked
  };
};
