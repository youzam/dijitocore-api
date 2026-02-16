const csv = require("csvtojson");
const XLSX = require("xlsx");

const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const notificationService = require("../../services/notifications/notification.service");

/**
 * =========================
 * CREATE CUSTOMER
 * =========================
 */
exports.createCustomer = async (businessId, payload, req) => {
  const { phone, altPhone, nationalId } = payload;

  // Strict duplicate detection (cross-field)
  const duplicate = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: [
        { phone },
        { altPhone: phone },
        { phone: altPhone },
        { altPhone },
        { nationalId },
      ].filter(Boolean),
    },
  });

  if (duplicate) {
    throw new AppError("customer.already_exists", 409);
  }

  const customer = await prisma.customer.create({
    data: {
      ...payload,
      businessId,
      status: "ACTIVE",
      riskScore: 0,
    },
  });

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, businessCode: true },
    });

    if (business && customer.phone) {
      await notificationService.sendCustomerWelcome({
        phone: customer.phone,
        businessName: business.name,
        businessCode: business.businessCode,
        locale: req.locale,
      });
    }
  } catch (e) {
    console.error("SMS send failed:", e.message);
  }

  return customer;
};

/**
 * =========================
 * LIST CUSTOMERS
 * =========================
 */
exports.listCustomers = async (businessId, query) => {
  const page = parseInt(query.page || 1);
  const limit = parseInt(query.limit || 20);
  const skip = (page - 1) * limit;

  const where = { businessId };

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.blacklisted !== undefined) {
    where.isBlacklisted = query.blacklisted === "true";
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    data: customers,
    meta: { total, page, limit },
  };
};

/**
 * =========================
 * GET CUSTOMER
 * =========================
 */
exports.getCustomer = async (businessId, id) => {
  const customer = await prisma.customer.findFirst({
    where: { id, businessId },
  });

  if (!customer) {
    throw new AppError("customer.not_found", 404);
  }

  return customer;
};

/**
 * =========================
 * UPDATE CUSTOMER
 * =========================
 */
exports.updateCustomer = async (businessId, id, payload) => {
  const existing = await exports.getCustomer(businessId, id);

  const { phone, altPhone, nationalId } = payload;

  if (phone || altPhone || nationalId) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        businessId,
        NOT: { id },
        OR: [
          { phone },
          { altPhone: phone },
          { phone: altPhone },
          { altPhone },
          { nationalId },
        ].filter(Boolean),
      },
    });

    if (duplicate) {
      throw new AppError("customer.already_exists", 409);
    }
  }

  // Protect financial fields
  delete payload.totalPaid;
  delete payload.totalOutstanding;
  delete payload.totalContracts;
  delete payload.riskScore;

  return prisma.customer.update({
    where: { id },
    data: payload,
  });
};

/**
 * =========================
 * UPDATE STATUS
 * =========================
 */
exports.updateStatus = async (businessId, id, status) => {
  await exports.getCustomer(businessId, id);

  return prisma.customer.update({
    where: { id },
    data: { status },
  });
};

/**
 * =========================
 * UPDATE BLACKLIST
 * =========================
 */
exports.updateBlacklist = async (businessId, id, isBlacklisted) => {
  await exports.getCustomer(businessId, id);

  return prisma.customer.update({
    where: { id },
    data: {
      isBlacklisted,
      riskScore: isBlacklisted ? 100 : 0,
    },
  });
};

/**
 * =========================
 * IMPORT CUSTOMERS (TRANSACTION SAFE)
 * =========================
 */
exports.importCustomers = async (businessId, req) => {
  if (!req.files || !req.files.file) {
    throw new AppError("customer.file_required", 400);
  }

  const file = req.files.file;
  let rows = [];

  if (file.name.endsWith(".csv")) {
    rows = await csv().fromString(file.data.toString());
  } else {
    const workbook = XLSX.read(file.data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  }

  if (!rows.length) {
    throw new AppError("customer.empty_import", 400);
  }

  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (!r.fullName || !r.phone) {
        skipped++;
        continue;
      }

      const exists = await tx.customer.findFirst({
        where: {
          businessId,
          OR: [{ phone: r.phone }, { altPhone: r.phone }],
        },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await tx.customer.create({
        data: {
          businessId,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email,
          nationalId: r.nationalId,
          status: "ACTIVE",
          riskScore: 0,
        },
      });

      imported++;
    }

    await tx.customerImportLog.create({
      data: {
        businessId,
        fileName: file.name,
        totalRows: rows.length,
        imported,
        skipped,
      },
    });
  });

  return { imported, skipped };
};
