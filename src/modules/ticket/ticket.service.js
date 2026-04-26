const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const { createSupportTicket } = require("../../utils/supportTicket.helper");
const storageManager = require("../../utils/storage/storage.manager");

/*
|--------------------------------------------------------------------------
| Create Ticket (BUSINESS_OWNER ONLY)
|--------------------------------------------------------------------------
*/
exports.createTicket = async ({ user, subject, description, priority }) => {
  if (user.role !== "BUSINESS_OWNER") {
    throw new AppError("Only business owner can create tickets", 403);
  }

  return createSupportTicket({
    businessId: user.businessId,
    createdByType: "TENANT",
    createdByUserId: user.id,
    subject,
    description,
    priority: priority || "MEDIUM",
  });
};

/*
|--------------------------------------------------------------------------
| Get My Tickets
|--------------------------------------------------------------------------
*/
exports.getMyTickets = async ({ user, query }) => {
  const { page = 1, limit = 10, status, priority } = query;

  const where = {
    businessId: user.businessId,
    deletedAt: null,
  };

  if (status) where.status = status;
  if (priority) where.priority = priority;

  const [data, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportTicket.count({ where }),
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

/*
|--------------------------------------------------------------------------
| Get Single Ticket (Ownership enforced)
|--------------------------------------------------------------------------
*/
exports.getMyTicketById = async ({ user, ticketId }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket || ticket.businessId !== user.businessId) {
    throw new AppError("support.ticket_not_found", 404);
  }

  return ticket;
};

/*
|--------------------------------------------------------------------------
| Reply to Ticket
|--------------------------------------------------------------------------
*/
exports.replyToTicket = async ({ user, ticketId, message }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket || ticket.businessId !== user.businessId) {
    throw new AppError("support.ticket_not_found", 404);
  }

  return prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: user.id,
      senderType: "USER",
      message,
    },
  });
};

/*
|--------------------------------------------------------------------------
| Add Attachment
|--------------------------------------------------------------------------
*/
exports.addAttachment = async ({ user, ticketId, files }) => {
  if (!files || files.length === 0) {
    throw new AppError("support.file_required", 400);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket || ticket.businessId !== user.businessId) {
    throw new AppError("support.ticket_not_found", 404);
  }

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const key = `tickets/${ticketId}/${Date.now()}_${file.name}`;

      const { key: fileKey, provider } = await storageManager.uploadFile({
        key,
        body: file.data, // 🔥 IMPORTANT (not buffer)
        contentType: file.mimetype,
      });

      return prisma.ticketAttachment.create({
        data: {
          ticketId,
          fileKey,
          provider,
        },
      });
    }),
  );

  return uploaded;
};
