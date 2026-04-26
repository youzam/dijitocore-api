const { prisma } = require("../config/prisma");
const AppError = require("../utils/AppError");
const { logAudit } = require("../utils/audit.helper");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const SLA_MAP = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 4,
};

const validatePriority = (priority) => {
  if (!PRIORITIES.includes(priority)) {
    throw new AppError("support.invalid_priority", 400);
  }
};

const calculateSLA = (priority) => {
  const hours = SLA_MAP[priority] || SLA_MAP.MEDIUM;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

/**
 * Create Support Ticket (CORE)
 * No role logic here — caller must pass correct values
 */
const createSupportTicket = async ({
  businessId,
  createdByType,
  createdByUserId,
  subject,
  description,
  priority = "MEDIUM",
}) => {
  // 🔒 Basic validation
  if (
    !businessId ||
    !createdByType ||
    !createdByUserId ||
    !subject ||
    !description
  ) {
    throw new AppError("support.invalid_ticket_data", 400);
  }

  // 🔒 Validate priority (enum-safe)
  validatePriority(priority);

  // 🧠 SLA calculation
  const slaDeadline = calculateSLA(priority);

  // 💾 Create ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      businessId,
      createdByType,
      createdByUserId,
      subject,
      description,
      priority,
      status: "OPEN",
      slaDeadline,
    },
  });

  // 📜 Audit log
  await logAudit({
    userId: createdByUserId,
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    action: "TICKET_CREATED",
    module: "SUPPORT",
    actorType: createdByType === "ADMIN" ? "ADMIN" : "TENANT",
  });

  return ticket;
};

module.exports = {
  createSupportTicket,
};
