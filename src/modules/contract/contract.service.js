const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const dayjs = require("dayjs");

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

  const balance = totalValue - downPayment;
  const totalInstallments = Math.ceil(balance / installmentAmount);

  const contractNumber = await generateContractNumber(businessId);

  const dates = generateScheduleDates({
    startDate,
    frequency,
    customDays,
    total: totalInstallments,
  });

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
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
        contractId: contract.id,
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

    return contract;
  });
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

  return prisma.$transaction(async (tx) => {
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
};

/* ================= COMPLETE ================= */

exports.completeContract = async ({ businessId, id }) => {
  const contract = await exports.getContractById({ businessId, id });

  if (contract.outstandingAmount > 0)
    throw new Error("contract.balance-not-zero");

  return prisma.$transaction(async (tx) => {
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
};

/* ================= SOFT DELETE ================= */

exports.softDeleteContract = async ({ businessId, id }) => {
  await exports.getContractById({ businessId, id });

  return prisma.contract.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
