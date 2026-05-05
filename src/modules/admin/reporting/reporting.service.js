const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const prisma = require('../../../config/prisma');
const { logAudit } = require('../../../utils/audit.helper');

// =============================
// CACHE
// =============================
const cache = new Map();

const getCache = (key) => cache.get(key);

const setCache = (key, value) => {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), 60000);
};

// =============================
// DATE FILTER
// =============================
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};

  return {
    createdAt: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    },
  };
};

// =============================
// PAGINATION
// =============================
const buildPagination = (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  return { skip, take: Number(limit) };
};

// =============================
// EXPORT HELPERS
// =============================
const generateCSV = (data) => {
  const parser = new Parser();
  return parser.parse(data);
};

const generateExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  if (data.length > 0) {
    sheet.columns = Object.keys(data[0]).map((key) => ({
      header: key,
      key,
    }));
    sheet.addRows(data);
  }

  return workbook.xlsx.writeBuffer();
};

const generatePDF = (data) => {
  const doc = new PDFDocument();
  let buffers = [];

  doc.on('data', buffers.push.bind(buffers));

  data.forEach((item) => {
    doc.text(JSON.stringify(item, null, 2));
    doc.moveDown();
  });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
};

const handleExport = async (format, data) => {
  if (!format) return null;

  if (format === 'csv') return generateCSV(data);
  if (format === 'excel') return await generateExcel(data);
  if (format === 'pdf') return await generatePDF(data);

  return null;
};

// =============================
// COMMON QUERY BUILDER
// =============================
const buildWhere = (query) => {
  const { startDate, endDate, businessId, status, type, gateway } = query;

  return {
    ...buildDateFilter(startDate, endDate),
    ...(businessId && { businessId }),
    ...(status && { status }),
    ...(type && { type }),
    ...(gateway && { gateway }),
  };
};

// =============================
// GENERIC REPORT HANDLER
// =============================
const processReport = async ({ query, model, where, include, select }) => {
  const { page = 1, limit = 20, format } = query;

  const cacheKey = `report:${model}:${JSON.stringify(query)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const total = await prisma[model].count({ where });

  const { skip, take } = buildPagination(page, limit);

  const data = await prisma[model].findMany({
    where,
    ...(include && { include }),
    ...(select && { select }),
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });

  // EXPORT
  const exportFile = await handleExport(format, data);
  if (exportFile) {
    return {
      export: true,
      format,
      file: exportFile,
    };
  }

  const result = {
    summary: { totalRecords: total },
    meta: {
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
    data,
  };

  setCache(cacheKey, result);
  return result;
};

// =============================
// 1. TRANSACTIONS
// =============================
exports.getTransactionReport = async (query) => {
  return processReport({
    query,
    model: 'transaction',
    where: buildWhere(query),
    include: { business: true, subscription: true },
  });
};

// =============================
// 2. MONTHLY REVENUE
// =============================
exports.getMonthlyRevenueReport = async (query) => {
  const { startDate, endDate, format } = query;

  const cacheKey = `report:monthlyRevenue:${JSON.stringify(query)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const where = {
    ...buildDateFilter(startDate, endDate),
    status: 'SUCCESS',
  };

  const payments = await prisma.transaction.findMany({
    where,
    select: { amount: true, createdAt: true },
  });

  const grouped = {};

  payments.forEach((p) => {
    const month = new Date(p.createdAt).toISOString().slice(0, 7);
    grouped[month] = (grouped[month] || 0) + Number(p.amount);
  });

  const data = Object.entries(grouped).map(([month, amount]) => ({
    month,
    amount,
  }));

  const exportFile = await handleExport(format, data);
  if (exportFile) return { export: true, format, file: exportFile };

  const result = {
    summary: {
      totalRevenue: payments.reduce((s, p) => s + Number(p.amount), 0),
    },
    breakdown: grouped,
    data,
  };

  setCache(cacheKey, result);
  return result;
};

// =============================
// 3–5. FINANCIAL REPORTS
// =============================
exports.getSetupFeeReport = async (query) => {
  return processReport({
    query,
    model: 'transaction',
    where: {
      ...buildDateFilter(query.startDate, query.endDate),
      type: 'SETUP_FEE',
      status: 'SUCCESS',
    },
  });
};

exports.getSubscriptionRevenueReport = async (query) => {
  return processReport({
    query,
    model: 'transaction',
    where: {
      ...buildDateFilter(query.startDate, query.endDate),
      type: 'SUBSCRIPTION',
      status: 'SUCCESS',
    },
  });
};

exports.getRefundReport = async (query) => {
  return processReport({
    query,
    model: 'transaction',
    where: {
      ...buildDateFilter(query.startDate, query.endDate),
      type: 'REFUND',
    },
  });
};

// =============================
// 6. COUPONS
// =============================
exports.getCouponReport = async (query) => {
  const { startDate, endDate, format } = query;

  const where = {
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const coupons = await prisma.coupon.findMany({
    include: {
      usages: {
        where,
      },
    },
  });

  const data = coupons.map((c) => {
    const totalUsage = c.usages.length;

    const totalRevenue = c.usages.reduce(
      (sum, u) => sum + Number(u.discountAmount || 0),
      0,
    );

    return {
      id: c.id,
      code: c.code,
      usageCount: totalUsage,
      totalDiscountGiven: totalRevenue,
      avgDiscount: totalUsage ? totalRevenue / totalUsage : 0,
    };
  });

  const exportFile = await handleExport(format, data);
  if (exportFile) {
    return { export: true, format, file: exportFile };
  }

  return {
    summary: {
      totalCoupons: coupons.length,
      totalUsage: data.reduce((s, c) => s + c.usageCount, 0),
      totalDiscountGiven: data.reduce((s, c) => s + c.totalDiscountGiven, 0),
    },
    data,
  };
};

// =============================
// 7. SUPPORT
// =============================
exports.getSupportReport = async (query) => {
  const { startDate, endDate, format } = query;

  const where = {
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
  });

  let totalResolutionTime = 0;
  let resolvedCount = 0;

  const data = tickets.map((t) => {
    let resolutionTime = null;

    if (t.status === 'CLOSED' && t.updatedAt) {
      resolutionTime = (new Date(t.updatedAt) - new Date(t.createdAt)) / 1000; // seconds

      totalResolutionTime += resolutionTime;
      resolvedCount++;
    }

    return {
      id: t.id,
      status: t.status,
      priority: t.priority,
      resolutionTime,
    };
  });

  const avgResolutionTime = resolvedCount
    ? totalResolutionTime / resolvedCount
    : 0;

  const open = tickets.filter((t) => t.status === 'OPEN').length;
  const closed = tickets.filter((t) => t.status === 'CLOSED').length;

  const exportFile = await handleExport(format, data);
  if (exportFile) {
    return { export: true, format, file: exportFile };
  }

  return {
    summary: {
      totalTickets: tickets.length,
      open,
      closed,
      avgResolutionTime, // seconds
    },
    data,
  };
};

// =============================
// 8. AUDIT
// =============================
exports.getAuditReport = async (query) => {
  return processReport({
    query,
    model: 'auditLog',
    where: buildDateFilter(query.startDate, query.endDate),
  });
};

// =============================
// 9. COMPLIANCE
// =============================
exports.getComplianceReport = async (query) => {
  const where = {};

  if (query.startDate && query.endDate) {
    where.createdAt = {
      gte: new Date(query.startDate),
      lte: new Date(query.endDate),
    };
  }

  return processReport({
    query,
    model: 'complianceLog',
    where,
  });
};

// =============================
// EXPORT STORAGE PATH
// =============================
const EXPORT_DIR = path.join(__dirname, '../../../../uploads/reports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// =============================
// ASYNC EXPORT CREATOR
// =============================
exports.createAsyncExport = async (query, adminId, type) => {
  const record = await prisma.reportExport.create({
    data: {
      type,
      format: query.format,
      status: 'PENDING',
      requestedBy: adminId,
    },
  });

  // BACKGROUND JOB (simple async)
  setImmediate(async () => {
    try {
      let data;

      if (type === 'transactions') {
        data = await exports.getTransactionReport({ ...query, format: null });
      }

      if (type === 'revenue') {
        data = await exports.getMonthlyRevenueReport({
          ...query,
          format: null,
        });
      }

      const fileBuffer = await handleExport(query.format, data.data || data);

      const fileName = `${type}_${record.id}.${query.format}`;
      const filePath = path.join(EXPORT_DIR, fileName);

      fs.writeFileSync(filePath, fileBuffer);

      await prisma.reportExport.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          filePath,
          completedAt: new Date(),
        },
      });

      await logAudit({
        userId: adminId,
        entityType: 'REPORT_EXPORT',
        entityId: record.id,
        action: 'REPORT_EXPORT_COMPLETED',
        module: 'REPORTING',
        actorType: 'SYSTEM',
      });
    } catch {
      await prisma.reportExport.update({
        where: { id: record.id },
        data: { status: 'FAILED' },
      });

      await logAudit({
        userId: adminId,
        entityType: 'REPORT_EXPORT',
        entityId: record.id,
        action: 'REPORT_EXPORT_FAILED',
        module: 'REPORTING',
        actorType: 'SYSTEM',
      });
    }
  });

  await logAudit({
    userId: adminId,
    entityType: 'REPORT_EXPORT',
    entityId: record.id,
    action: 'REPORT_EXPORT_CREATED',
    module: 'REPORTING',
    actorType: 'ADMIN',
  });

  return record;
};

exports.getExportHistory = async (adminId) => {
  return prisma.reportExport.findMany({
    where: { requestedBy: adminId },
    orderBy: { createdAt: 'desc' },
  });
};

exports.downloadExportFile = async (id) => {
  const record = await prisma.reportExport.findUnique({ where: { id } });

  if (!record || record.status !== 'COMPLETED') {
    throw new Error('Export not ready');
  }

  return record;
};

exports.getSupportSummaryReport = async (query) => {
  const where = {};

  if (query.businessId) {
    where.businessId = query.businessId;
  }

  const [total, open, inProgress, resolved, escalated] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
    prisma.ticket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...where, escalated: true } }),
  ]);

  return {
    total,
    open,
    inProgress,
    resolved,
    escalated,
  };
};

exports.getSupportSLAReport = async () => {
  const now = new Date();

  const [totalActive, breached] = await Promise.all([
    prisma.ticket.count({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    }),
    prisma.ticket.count({
      where: {
        slaDeadline: { lt: now },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    }),
  ]);

  const complianceRate =
    totalActive === 0 ? 100 : ((totalActive - breached) / totalActive) * 100;

  return {
    totalActive,
    breached,
    complianceRate,
  };
};

exports.getTicketsPerBusinessReport = async () => {
  const data = await prisma.ticket.groupBy({
    by: ['businessId'],
    _count: true,
    orderBy: {
      _count: {
        businessId: 'desc',
      },
    },
  });

  return data;
};
