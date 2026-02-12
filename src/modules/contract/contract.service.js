const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const dayjs = require("dayjs");

const AppError = require("../../utils/AppError");
const {
  createNotification,
} = require("../../services/notifications/notification.service");

/* ================= UTILITIES ================= */

const generateContractNumber = async (businessId) => {
  const count = await prisma.contract.count({ where: { businessId } });
  const year = new Date().getFullYear();
  return `CNT-${year}-${String(count + 1).padStart(5, "0")}`;
};

const generateScheduleDates = ({ startDate, frequency, customDays, total }) => {
  let current = dayjs(startDate);
  const dates = [];

  for (let i = 0; i < total; i++) {
    dates.push(current.toDate());

    if (frequency === "DAILY") current = current.add(1, "day");
    if (frequency === "WEEKLY") current = current.add(1, "week");
    if (frequency === "MONTHLY") current = current.add(1, "month");
    if (frequency === "CUSTOM") current = current.add(customDays, "day");
  }

  return dates;
};

/* ================= CREATE ================= */

exports.createContract = async ({ businessId, userId, payload }) => {
  const {
    customerId,
    title,
    description,
    assets,
    totalValue,
    downPayment,
    installmentAmount,
    frequency,
    customDays,
    startDate,
  } = payload;

  if (downPayment > totalValue) throw new Error("contract.invalid-downpayment");
  if (installmentAmount <= 0) throw new Error("contract.invalid-installment");
  if (frequency === "CUSTOM" && !customDays)
    throw new Error("contract.custom-days-required");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });

  if (!customer) throw new Error("contract.customer-not-found");
  if (customer.status === "INACTIVE" || customer.isBlacklisted) {
    throw new Error("customer.inactiveBlacklisted");
  }

  const balance = totalValue - downPayment;
  const totalInstallments = Math.ceil(balance / installmentAmount);

  const contractNumber = await generateContractNumber(businessId);

  const dates = generateScheduleDates({
    startDate,
    frequency,
    customDays,
    total: totalInstallments,
  });

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.contract.create({
      data: {
        businessId,
        customerId,
        contractNumber,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        title,
        description,
        totalValue,
        downPayment,
        balance,
        installmentAmount,
        totalInstallments,
        paidAmount: 0,
        outstandingAmount: balance,
        frequency,
        customDays,
        startDate: new Date(startDate),
        status: "ACTIVE",
        activatedAt: new Date(),
        createdBy: userId,
        assets: {
          create: assets.map((a) => ({
            name: a.name,
            quantity: a.quantity,
            unitPrice: a.unitPrice,
          })),
        },
      },
    });

    await tx.installmentSchedule.createMany({
      data: dates.map((d) => ({
        contractId: created.id,
        dueDate: d,
        amount: installmentAmount,
      })),
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalContracts: { increment: 1 },
        activeContracts: { increment: 1 },
        totalOutstanding: { increment: balance },
      },
    });

    return created;
  });

  await createNotification({
    businessId,
    customerId,
    contractId: contract.id,
    type: "CONTRACT",
    channel: "IN_APP",
    titleKey: "notification.contract.active.title",
    messageKey: "notification.contract.active.body",
    templateVars: {
      contract: contract.contractNumber,
      amount: contract.totalValue,
    },
    recipient: customerId,
  });

  await createNotification({
    businessId,
    customerId,
    contractId: contract.id,
    type: "CONTRACT",
    channel: "SMS",
    titleKey: "notification.contract.active.title",
    messageKey: "notification.contract.active.body",
    templateVars: {
      contract: contract.contractNumber,
      amount: contract.totalValue,
    },
    recipient: customer.phone,
  });

  const businessUsers = await prisma.user.findMany({
    where: { businessId, status: "ACTIVE" },
  });

  for (const u of businessUsers) {
    await createNotification({
      businessId,
      userId: u.id,
      contractId: contract.id,
      type: "CONTRACT",
      channel: "IN_APP",
      titleKey: "notification.contract.active.staff.title",
      messageKey: "notification.contract.active.staff.body",
      templateVars: {
        customer: customer.fullName,
        amount: contract.totalValue,
      },
      recipient: u.id,
    });
  }

  return contract;
};

/* ================= READ ================= */

exports.getContracts = async ({ businessId }) => {
  return prisma.contract.findMany({
    where: { businessId, deletedAt: null },
    include: { assets: true, schedules: true },
    orderBy: { createdAt: "desc" },
  });
};

exports.getContractById = async ({ businessId, id }) => {
  const contract = await prisma.contract.findFirst({
    where: { id, businessId, deletedAt: null },
    include: { assets: true, schedules: true },
  });

  if (!contract) throw new Error("contract.not-found");

  return contract;
};

/* ================= UPDATE ================= */

exports.updateContract = async ({ businessId, id, payload }) => {
  await exports.getContractById({ businessId, id });

  return prisma.contract.update({
    where: { id },
    data: {
      title: payload.title,
      description: payload.description,
    },
  });
};

/* ================= TERMINATE ================= */

exports.terminateContract = async ({ businessId, id, userId, reason }) => {
  const contract = await exports.getContractById({ businessId, id });

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(),
        terminationReason: reason,
        terminatedBy: userId,
      },
    });

    await tx.customer.update({
      where: { id: contract.customerId },
      data: {
        activeContracts: { decrement: 1 },
        totalOutstanding: { decrement: contract.outstandingAmount },
      },
    });
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: "CONTRACT",
    channel: "IN_APP",
    titleKey: "notification.contract.terminated.title",
    messageKey: "notification.contract.terminated.body",
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerId,
  });

  return true;
};

/* ================= COMPLETE ================= */

exports.completeContract = async ({ businessId, id }) => {
  const contract = await exports.getContractById({ businessId, id });

  if (contract.outstandingAmount > 0)
    throw new Error("contract.balance-not-zero");

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await tx.customer.update({
      where: { id: contract.customerId },
      data: {
        activeContracts: { decrement: 1 },
      },
    });
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: "CONTRACT",
    channel: "IN_APP",
    titleKey: "notification.contract.completed.title",
    messageKey: "notification.contract.completed.body",
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerId,
  });

  await createNotification({
    businessId,
    customerId: contract.customerId,
    contractId: contract.id,
    type: "CONTRACT",
    channel: "SMS",
    titleKey: "notification.contract.completed.title",
    messageKey: "notification.contract.completed.body",
    templateVars: {
      contract: contract.contractNumber,
    },
    recipient: contract.customerPhone,
  });

  return true;
};

/* ================= SOFT DELETE ================= */

exports.softDeleteContract = async ({ businessId, id }) => {
  await exports.getContractById({ businessId, id });

  return prisma.contract.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

/* ======================================================
   MODULE 8 PATCH — CUSTOMER PORTAL (READ ONLY)
   ADDED BELOW WITHOUT TOUCHING ABOVE CODE
   ====================================================== */

exports.getCustomerContracts = async ({ id }) => {
  const customerId = id;
  if (!customerId) {
    throw new AppError("auth.unauthorized", 401);
  }

  const contracts = await prisma.contract.findMany({
    where: { customerId },
    include: {
      assets: true,
      schedules: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // get payments grouped by contract
  const payments = await prisma.payment.findMany({
    where: {
      customerId,
      status: "POSTED", // au CONFIRMED kulingana na schema yako
    },
    select: {
      contractId: true,
      amount: true,
    },
  });

  const paymentsMap = {};
  for (const p of payments) {
    paymentsMap[p.contractId] = (paymentsMap[p.contractId] || 0) + p.amount;
  }

  return contracts.map((contract) => {
    const totalPaid = paymentsMap[contract.id] || 0;

    return {
      ...contract,
      totalPaid,
      outstandingAmount: contract.totalValue - totalPaid,
      progress:
        contract.totalValue > 0
          ? Math.round((totalPaid / contract.totalValue) * 100)
          : 0,
    };
  });
};

exports.getCustomerContractById = async ({ contractId, customerId }) => {
  if (!customerId) {
    throw new AppError("auth.unauthorized", 401);
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerId,
    },
    include: {
      assets: true,
      schedules: true,
    },
  });

  if (!contract) return null;

  // fetch payments separately (schema-correct)
  const payments = await prisma.payment.findMany({
    where: {
      contractId,
      customerId,
      status: "POSTED", // au CONFIRMED kulingana na schema yako
    },
    select: {
      amount: true,
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    ...contract,
    totalPaid,
    outstandingAmount: contract.totalValue - totalPaid,
    progress:
      contract.totalValue > 0
        ? Math.round((totalPaid / contract.totalValue) * 100)
        : 0,
  };
};

exports.getCustomerContractForStatement = async (contractId, user) => {
  if (
    !user.id ||
    user.isBlacklisted ||
    user.status === "INACTIVE" ||
    user.status === "SUSPENDED"
  )
    return null;

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerId: user.id,
    },
  });

  if (!contract) return null;

  const payments = await prisma.payment.findMany({
    where: {
      contractId,
      customerId: user.customerId,
      status: "POSTED",
    },
    orderBy: { createdAt: "asc" },
  });

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return {
    contract: {
      ...contract,
      totalPaid,
      outstandingAmount: contract.totalValue - totalPaid,
    },
    payments,
  };
};
