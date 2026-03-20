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
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    order = "desc",

    // 🔥 NEW FILTERS (from query)
    country,
    packageId,
    gateway,
    startDate,
    endDate,
  } = query;

  const skip = (Number(page) - 1) * Number(limit);

  // 🔹 EXISTING BASE WHERE
  const where = buildWhereClause(query);

  /**
   * 🔥 SAFE EXTENSION (NO OVERWRITE)
   */
  if (!where.subscription) {
    where.subscription = {};
  }

  if (packageId) {
    where.subscription.packageId = packageId;
  }

  if (country) {
    where.subscription.business = {
      ...(where.subscription.business || {}),
      country,
    };
  }

  if (gateway) {
    where.gateway = gateway;
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(where.createdAt || {}),
    };

    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }

    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  // 🔥 FETCH PAYMENTS + ADJUSTMENTS
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

    retryCount: payment.retryCount || 0,
    hasAuditLog: !!payment.metadata,
  }));

  /**
   * 🔥 MAP ADJUSTMENTS
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
   * 🔥 MERGE + SORT (UNCHANGED)
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
 * Get single transaction by ID
 */
/**
 * Get single transaction by ID (SAFE — NO ASSUMPTIONS)
 */
exports.getTransactionById = async (id) => {
  if (!id) {
    throw new AppError("commerce.transaction_id_required", 400);
  }

  // 🔍 1. Check subscription payments
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          business: true,
          package: true,
        },
      },
    },
  });

  if (payment) {
    return {
      id: payment.id,

      businessId: payment.subscription.businessId,
      businessName: payment.subscription.business?.name || null,
      country: payment.subscription.business?.country || null,

      packageId: payment.subscription.packageId,
      packageName: payment.subscription.package?.name || null,

      subscriptionAmount:
        payment.type === "SUBSCRIPTION" ? payment.amount : null,

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

      retryCount: payment.retryCount || 0,
      hasAuditLog: !!payment.metadata,
    };
  }

  // 🔍 2. Check financial adjustments
  const adjustment = await prisma.financialAdjustment.findUnique({
    where: { id },
  });

  if (adjustment) {
    return {
      id: adjustment.id,

      businessId: adjustment.businessId,
      businessName: null,
      country: null,

      packageId: null,
      packageName: null,

      subscriptionAmount: null,
      setupFeeAmount: null,

      amount: adjustment.amount,
      currency: null,

      type: "MANUAL_ADJUSTMENT",
      status: "SUCCESS",

      gateway: null,

      invoiceUrl: null,
      webhookStatus: null,
      adminOverride: true,

      paidAt: adjustment.createdAt,
      createdAt: adjustment.createdAt,

      retryCount: 0,
      hasAuditLog: false,
    };
  }

  // ❌ Not found
  throw new AppError("commerce.transaction_not_found", 404);
};

/**
 * 🔥 DRILLDOWN (UPDATED)
 */
exports.getTransactionDrilldown = async (id) => {
  if (!id) {
    throw new AppError("commerce.transaction_id_required", 400);
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: {
      subscription: {
        include: {
          business: true,
          package: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError("commerce.transaction_not_found", 404);
  }

  return {
    id: payment.id,

    // 🔹 BUSINESS
    business: {
      id: payment.subscription?.businessId || null,
      name: payment.subscription?.business?.name || null,
      country: payment.subscription?.business?.country || null,
    },

    // 🔹 PACKAGE
    package: {
      id: payment.subscription?.packageId || null,
      name: payment.subscription?.package?.name || null,
    },

    // 🔹 FINANCIAL
    financial: {
      amount: payment.amount,
      currency: payment.currency,
      type: normalizeTransactionType(payment.type),
      status: payment.status,
      gateway: payment.gateway || null,
    },

    // 🔹 LIFECYCLE
    lifecycle: {
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      webhookStatus: payment.webhookStatus || null,
      retryCount: payment.retryCount || 0,
      adminOverride: payment.adminOverride || false,
    },

    // 🔥 RAW GATEWAY PAYLOAD
    gatewayPayload: payment.metadata || null,

    // 🔥 REAL AUDIT (DERIVED — NOT FAKE)
    audit: {
      hasAudit: !!payment.metadata,
      source: payment.metadata ? "PAYMENT_METADATA" : null,
    },

    // 🔹 DEBUG
    debug: {
      hasMetadata: !!payment.metadata,
      hasRetries: (payment.retryCount || 0) > 0,
    },
  };
};
