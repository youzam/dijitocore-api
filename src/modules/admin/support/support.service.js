const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");
const { logAudit } = require("../../../utils/audit.helper");

/*
|--------------------------------------------------------------------------
| Constants & Helpers
|--------------------------------------------------------------------------
*/

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const SLA_MAP = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 4,
};

const calculateSLA = (priority) => {
  const hours = SLA_MAP[priority] || SLA_MAP.MEDIUM;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const validatePriority = (priority) => {
  if (!PRIORITIES.includes(priority)) {
    throw new AppError("support.invalid_priority", 400);
  }
};

const validateStatus = (status) => {
  if (!STATUSES.includes(status)) {
    throw new AppError("support.invalid_status", 400);
  }
};

const buildFilters = (query) => {
  const where = {
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.businessId) where.businessId = query.businessId;
  if (query.assignedAdminId) where.assignedAdminId = query.assignedAdminId;

  return where;
};

const emitEvent = async (event, payload) => {
  try {
    const {
      createNotification,
    } = require("../../../services/notifications/notification.service");

    if (event === "TICKET_ASSIGNED") {
      await createNotification(payload);
    }

    if (event === "TICKET_ESCALATED") {
      await createNotification(payload);
    }

    if (event === "TICKET_MESSAGE") {
      await createNotification(payload);
    }
  } catch (err) {
    console.error("Event failed:", err);
  }
};

/*
|--------------------------------------------------------------------------
| Ticket CRUD
|--------------------------------------------------------------------------
*/

exports.createTicket = async (data) => {
  const {
    businessId,
    userId,
    subject,
    description,
    priority = "MEDIUM",
  } = data;

  if (!businessId || !subject || !description) {
    throw new AppError("support.invalid_ticket_data", 400);
  }

  validatePriority(priority);

  const result = await prisma.ticket.create({
    data: {
      businessId,
      userId,
      subject,
      description,
      priority,
      status: "OPEN",
      slaDeadline: calculateSLA(priority),
    },
  });

  await logAudit({
    userId: userId,
    entityType: "TICKET",
    entityId: result.id,
    action: "TICKET_CREATED",
    module: "SUPPORT",
    actorType: "USER",
  });

  return result;
};

exports.getTickets = async (query) => {
  const { page = 1, limit = 10 } = query;

  const where = buildFilters(query);

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
    },
  };
};

exports.getTicketById = async (id) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    throw new AppError("support.ticket_not_found", 404);
  }

  return ticket;
};

exports.updateTicket = async (id, data) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  if (data.priority) {
    validatePriority(data.priority);
    data.slaDeadline = calculateSLA(data.priority);
  }

  if (data.status) {
    validateStatus(data.status);
  }

  const result = await prisma.ticket.update({
    where: { id },
    data,
  });

  await logAudit({
    userId: null,
    entityType: "TICKET",
    entityId: id,
    action: "TICKET_UPDATED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });

  return result;
};

exports.deleteTicket = async (id) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  const result = await prisma.ticket.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  await logAudit({
    userId: null,
    entityType: "TICKET",
    entityId: id,
    action: "TICKET_DELETED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });

  return true;
};

/*
|--------------------------------------------------------------------------
| Assignment
|--------------------------------------------------------------------------
*/

exports.assignTicket = async (ticketId, adminId) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket || ticket.deletedAt) {
    throw new AppError("support.ticket_not_found", 404);
  }

  const admin = await prisma.systemAdmin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new AppError("support.admin_not_found", 404);
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedAdminId: adminId,
      status: "IN_PROGRESS",
    },
  });

  await emitEvent("TICKET_ASSIGNED", {
    userId: adminId,
    type: "TICKET_ASSIGNED",
    channel: "IN_APP",
    titleKey: "notification.ticket_assigned.title",
    messageKey: "notification.ticket_assigned.body",
    templateVars: {
      ticketId,
      subject: ticket.subject,
    },
    recipient: adminId,
  });

  await logAudit({
    userId: adminId,
    entityType: "TICKET",
    entityId: ticketId,
    action: "TICKET_ASSIGNED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });
  return updatedTicket;
};

/*
|--------------------------------------------------------------------------
| Priority & Status
|--------------------------------------------------------------------------
*/

exports.changePriority = async (id, priority) => {
  validatePriority(priority);

  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  const result = await prisma.ticket.update({
    where: { id },
    data: {
      priority,
      slaDeadline: calculateSLA(priority),
    },
  });

  await logAudit({
    userId: null,
    entityType: "TICKET",
    entityId: id,
    action: "TICKET_PRIORITY_CHANGED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });

  return result;
};

exports.changeStatus = async (id, status) => {
  validateStatus(status);

  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  const result = await prisma.ticket.update({
    where: { id },
    data: { status },
  });

  await logAudit({
    userId: null,
    entityType: "TICKET",
    entityId: id,
    action: "TICKET_STATUS_CHANGED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });

  return result;
};

exports.deleteTicket = async (id) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket || ticket.deletedAt) {
    throw new AppError("support.ticket_not_found", 404);
  }

  await prisma.ticket.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return true;
};

/*
|--------------------------------------------------------------------------
| SLA & Escalation
|--------------------------------------------------------------------------
*/

exports.getSLABreachedTickets = async () => {
  return prisma.ticket.findMany({
    where: {
      slaDeadline: { lt: new Date() },
      escalated: false,
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
  });
};

exports.escalateTicket = async (id) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket || ticket.deletedAt) {
    throw new AppError("support.ticket_not_found", 404);
  }

  if (ticket.escalated) return ticket;

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      escalated: true,
      priority: "URGENT",
    },
  });

  if (ticket.assignedAdminId) {
    await emitEvent("TICKET_ESCALATED", {
      userId: ticket.assignedAdminId,
      type: "TICKET_ESCALATED",
      channel: "IN_APP",
      titleKey: "notification.ticket_escalated.title",
      messageKey: "notification.ticket_escalated.body",
      templateVars: {
        ticketId: id,
        subject: ticket.subject,
      },
      recipient: ticket.assignedAdminId,
    });
  }

  await logAudit({
    userId: ticket.assignedAdminId || null,
    entityType: "TICKET",
    entityId: id,
    action: "TICKET_ESCALATED",
    module: "SUPPORT",
    actorType: "SYSTEM",
  });

  return updatedTicket;
};

/*
|--------------------------------------------------------------------------
| Internal Notes
|--------------------------------------------------------------------------
*/

exports.addInternalNote = async (ticketId, adminId, note) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  const result = await prisma.ticketNote.create({
    data: { ticketId, adminId, note },
  });

  await logAudit({
    userId: adminId,
    entityType: "TICKET_NOTE",
    entityId: result.id,
    action: "INTERNAL_NOTE_ADDED",
    module: "SUPPORT",
    actorType: "ADMIN",
  });

  return result;
};

exports.getInternalNotes = async (ticketId) => {
  return prisma.ticketNote.findMany({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
  });
};

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

exports.addMessage = async (ticketId, senderId, senderType, message) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket || ticket.deletedAt) {
    throw new AppError("support.ticket_not_found", 404);
  }

  const newMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId,
      senderType,
      message,
    },
  });

  if (senderType === "USER" && ticket.assignedAdminId) {
    await emitEvent("TICKET_MESSAGE", {
      userId: ticket.assignedAdminId,
      type: "TICKET_MESSAGE",
      channel: "IN_APP",
      titleKey: "notification.ticket_message.title",
      messageKey: "notification.ticket_message.body",
      templateVars: {
        ticketId,
        message,
      },
      recipient: ticket.assignedAdminId,
    });
  }

  await logAudit({
    userId: senderId,
    entityType: "TICKET_MESSAGE",
    entityId: newMessage.id,
    action: "TICKET_MESSAGE_ADDED",
    module: "SUPPORT",
    actorType: senderType,
  });
  return newMessage;
};

exports.getMessages = async (ticketId) => {
  return prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
};

/*
|--------------------------------------------------------------------------
| Attachments
|--------------------------------------------------------------------------
*/

exports.addAttachment = async (ticketId, fileUrl) => {
  if (!fileUrl) {
    throw new AppError("support.invalid_file", 400);
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) throw new AppError("support.ticket_not_found", 404);

  const result = await prisma.ticketAttachment.create({
    data: { ticketId, fileUrl },
  });

  await logAudit({
    userId: null,
    entityType: "TICKET_ATTACHMENT",
    entityId: result.id,
    action: "TICKET_ATTACHMENT_ADDED",
    module: "SUPPORT",
    actorType: "USER",
  });

  return result;
};

exports.getAttachments = async (ticketId) => {
  return prisma.ticketAttachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
  });
};

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

exports.getTicketAnalytics = async () => {
  const [total, open, inProgress, resolved, escalated, slaBreached] =
    await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { escalated: true } }),
      prisma.ticket.count({
        where: {
          slaDeadline: { lt: new Date() },
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
    ]);

  return {
    total,
    open,
    inProgress,
    resolved,
    escalated,
    slaBreached,
  };
};

/*
|--------------------------------------------------------------------------
| Business View
|--------------------------------------------------------------------------
*/

exports.getTicketsByBusiness = async (businessId) => {
  return prisma.ticket.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
};
