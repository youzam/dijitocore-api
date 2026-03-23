const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
const buildPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildFilters = (query, businessId) => {
  const where = {
    businessId,
  };

  if (query.module) where.module = query.module;
  if (query.action) where.action = query.action;

  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    };
  }

  return where;
};

/*
|--------------------------------------------------------------------------
| Get Tenant Audit Logs
|--------------------------------------------------------------------------
*/
exports.getTenantAuditLogs = async (user, query) => {
  const { page, limit, skip } = buildPagination(query);

  const where = buildFilters(query, user.businessId);

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
  };
};

/*
|--------------------------------------------------------------------------
| Get Single Audit Log
|--------------------------------------------------------------------------
*/
exports.getTenantAuditLogById = async (id, user) => {
  const log = await prisma.auditLog.findFirst({
    where: {
      id,
      businessId: user.businessId,
    },
  });

  if (!log) {
    throw new AppError("audit.log_not_found", 404);
  }

  return log;
};
