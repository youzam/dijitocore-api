const csv = require('csvtojson');
const XLSX = require('xlsx');

const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const notificationService = require('../../services/notifications/notification.service');
const auditHelper = require('../../utils/audit.helper');
const subscriptionAuthority = require('../subscription/subscription.authority.service');

/**
 * =========================
 * CREATE CUSTOMER
 * =========================
 */
exports.createCustomer = async (businessId, payload, req) => {
  const { phone, whatsappPhone, nationalId } = payload;

  const duplicate = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: [
        { phone },
        { whatsappPhone: phone },
        { phone: whatsappPhone },
        { whatsappPhone },
        { nationalId },
      ].filter(Boolean),
    },
  });

  if (duplicate) {
    throw new AppError('customer.already_exists', 409);
  }

  const customer = await prisma.customer.create({
    data: {
      ...payload,
      businessId,
      status: 'ACTIVE',
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
    console.error('SMS send failed:', e.message);
  }

  await auditHelper.logAudit({
    businessId,
    userId: req?.user?.id || null,
    entityType: 'CUSTOMER',
    entityId: customer.id,
    action: 'CUSTOMER_CREATED',
    metadata: {
      name: customer.name,
    },
  });

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
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.blacklisted !== undefined) {
    where.isBlacklisted = query.blacklisted === 'true';
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
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
    throw new AppError('customer.not_found', 404);
  }

  return customer;
};

/**
 * =========================
 * UPDATE CUSTOMER
 * =========================
 */
exports.updateCustomer = async (businessId, id, payload, context) => {
  await exports.getCustomer(businessId, id);

  const { phone, whatsappPhone, nationalId } = payload;

  if (phone || whatsappPhone || nationalId) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        businessId,
        NOT: { id },
        OR: [
          { phone },
          { whatsappPhone: phone },
          { phone: whatsappPhone },
          { whatsappPhone },
          { nationalId },
        ].filter(Boolean),
      },
    });

    if (duplicate) {
      throw new AppError('customer.already_exists', 409);
    }
  }

  delete payload.totalPaid;
  delete payload.totalOutstanding;
  delete payload.totalContracts;
  delete payload.riskScore;

  const updated = await prisma.customer.update({
    where: { id },
    data: payload,
  });

  await auditHelper.logAudit({
    businessId,
    userId: context?.userId || null,
    entityType: 'CUSTOMER',
    entityId: id,
    action: 'CUSTOMER_UPDATED',
  });

  return updated;
};

/**
 * =========================
 * UPDATE STATUS
 * =========================
 */
exports.updateStatus = async (businessId, id, status, context) => {
  await exports.getCustomer(businessId, id);

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: { status },
  });

  await auditHelper.logAudit({
    businessId,
    userId: context?.userId || null,
    entityType: 'CUSTOMER',
    entityId: id,
    action: 'CUSTOMER_STATUS_UPDATED',
    metadata: { status },
  });

  return updatedCustomer;
};

/**
 * =========================
 * UPDATE BLACKLIST
 * =========================
 */
exports.updateBlacklist = async (businessId, id, isBlacklisted, context) => {
  await exports.getCustomer(businessId, id);

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: {
      isBlacklisted,
      riskScore: isBlacklisted ? 100 : 0,
    },
  });

  await auditHelper.logAudit({
    businessId,
    userId: context?.userId || null,
    entityType: 'CUSTOMER',
    entityId: id,
    action: 'CUSTOMER_BLACKLISTED',
    metadata: { isBlacklisted },
  });

  return updatedCustomer;
};

/**
 * =========================
 * IMPORT CUSTOMERS (TRANSACTION SAFE)
 * =========================
 */
exports.importCustomers = async (businessId, req, context) => {
  if (!req.files || !req.files.file) {
    throw new AppError('customer.file_required', 400);
  }

  await subscriptionAuthority.assertFeature(businessId, 'allowImportCustomers');

  const file = req.files.file;

  let rows = [];

  if (file.name.endsWith('.csv')) {
    rows = await csv().fromString(file.data.toString());
  } else {
    const workbook = XLSX.read(file.data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  }

  if (!rows.length) {
    throw new AppError('customer.empty_import', 400);
  }

  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (!r.fullName || !r.phone) {
        skipped++;
        continue;
      }
      console.log('content: ', r);

      const phone = r.phone ? String(r.phone).trim() : null;

      const exists = await tx.customer.findFirst({
        where: {
          businessId,
          OR: [{ phone }],
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
          phone: phone,
          email: r.email,
          nationalId: r.nationalId,
          status: 'ACTIVE',
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

  await auditHelper.logAudit({
    businessId,
    userId: context?.userId || null,
    entityType: 'CUSTOMER',
    entityId: 'BULK',
    action: 'CUSTOMER_IMPORTED',
    metadata: {
      total: rows.length,
      imported,
      skipped,
    },
  });

  return { imported, skipped };
};
