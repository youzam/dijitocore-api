const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

/**
 * Normalize transaction type (strict control from blueprint)
 */
const normalizeTransactionType = (type) => {
  const allowed = [
    "SUBSCRIPTION",
    "SETUP_FEE",
    "RENEWAL",
    "REFUND",
    "MANUAL_ADJUSTMENT",
  ];

  if (!type) return "SUBSCRIPTION";

  return allowed.includes(type) ? type : "SUBSCRIPTION";
};

/**
 * Build Prisma filters safely
 */
const buildWhereClause = (filters) => {
  const { businessId, status, type, gateway, startDate, endDate } = filters;

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
  };
};

/**
 * Get Transactions (ENTERPRISE LEVEL)
 */
exports.getTransactions = async (query) => {
  const { page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = query;

  const skip = (Number(page) - 1) * Number(limit);

  const where = buildWhereClause(query);

  const [total, payments] = await Promise.all([
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
  ]);

  const transactions = payments.map((payment) => ({
    id: payment.id,

    // Business
    businessId: payment.subscription.businessId,
    businessName: payment.subscription.business?.name || null,

    // Package
    packageId: payment.subscription.packageId,
    packageName: payment.subscription.package?.name || null,

    // Financial
    amount: payment.amount,
    currency: payment.currency,

    // Classification
    type: normalizeTransactionType(payment.type),
    status: payment.status,

    // Gateway
    gateway: payment.gateway || null,

    // Blueprint fields
    invoiceUrl: payment.invoiceUrl || null,
    webhookStatus: payment.webhookStatus || null,
    adminOverride: payment.adminOverride,

    // Time
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  }));

  return {
    data: transactions,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get Single Transaction (FULL DETAILS)
 */
exports.getTransactionById = async (id) => {
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

    businessId: payment.subscription.businessId,
    businessName: payment.subscription.business?.name || null,

    packageId: payment.subscription.packageId,
    packageName: payment.subscription.package?.name || null,

    amount: payment.amount,
    currency: payment.currency,

    type: normalizeTransactionType(payment.type),
    status: payment.status,

    gateway: payment.gateway,

    invoiceUrl: payment.invoiceUrl,
    webhookStatus: payment.webhookStatus,
    adminOverride: payment.adminOverride,

    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
};

/**
 * Transaction Drilldown (BLUEPRINT REQUIREMENT)
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

    // Raw gateway payload
    gatewayPayload: payment.gatewayPayload || null,

    // Retry tracking
    retryCount: payment.retryCount,

    // Webhook
    webhookStatus: payment.webhookStatus,

    // Metadata (extra debug info)
    metadata: payment.metadata || null,
  };
};
