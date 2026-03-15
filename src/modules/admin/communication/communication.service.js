const prisma = require("../../config/prisma");

class CommunicationService {
  /*
  |--------------------------------------------------------------------------
  | Announcement Methods
  |--------------------------------------------------------------------------
  */

  async createAnnouncement(data, adminId) {
    return prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        priority: data.priority,
        startAt: data.startAt,
        endAt: data.endAt,
        targetCountry: data.targetCountry,
        targetPackageId: data.targetPackageId,
        trialOnly: data.trialOnly || false,
        isEmergency: data.isEmergency || false,
        createdBy: adminId,
      },
    });
  }

  async updateAnnouncement(id, data) {
    return prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        message: data.message,
        priority: data.priority,
        startAt: data.startAt,
        endAt: data.endAt,
        targetCountry: data.targetCountry,
        targetPackageId: data.targetPackageId,
        trialOnly: data.trialOnly,
        isEmergency: data.isEmergency,
      },
    });
  }

  async deleteAnnouncement(id) {
    return prisma.announcement.delete({
      where: { id },
    });
  }

  async getAnnouncements(filters) {
    const where = {};

    if (filters.priority) where.priority = filters.priority;

    if (filters.isActive) {
      const now = new Date();
      where.startAt = { lte: now };
      where.endAt = { gte: now };
    }

    return prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getAnnouncementById(id) {
    return prisma.announcement.findUnique({
      where: { id },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Messaging Methods
  |--------------------------------------------------------------------------
  */

  async resolveRecipients(filters) {
    const where = {
      isActive: true,
      isSuspended: false,
    };

    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.packageId) {
      where.business = {
        subscription: {
          packageId: filters.packageId,
        },
      };
    }

    if (filters?.trialOnly) {
      where.business = {
        subscription: {
          isTrial: true,
        },
      };
    }

    return prisma.user.findMany({
      where,
      select: { id: true, email: true },
    });
  }

  async sendBroadcast(data, adminId) {
    const recipients = await this.resolveRecipients(data.filters);

    const message = await prisma.message.create({
      data: {
        title: data.title,
        body: data.body,
        channel: data.channel,
        createdBy: adminId,
      },
    });

    const recipientData = recipients.map((user) => ({
      messageId: message.id,
      userId: user.id,
      status: "PENDING",
    }));

    if (recipientData.length) {
      await prisma.messageRecipient.createMany({
        data: recipientData,
      });
    }

    return message;
  }

  async sendBatch(data, adminId) {
    const message = await prisma.message.create({
      data: {
        title: data.title,
        body: data.body,
        channel: data.channel,
        createdBy: adminId,
      },
    });

    const recipients = data.userIds.map((id) => ({
      messageId: message.id,
      userId: id,
      status: "PENDING",
    }));

    if (recipients.length) {
      await prisma.messageRecipient.createMany({
        data: recipients,
      });
    }

    return message;
  }

  async retryFailedMessages(messageId) {
    const failed = await prisma.messageRecipient.findMany({
      where: {
        messageId,
        status: "FAILED",
      },
    });

    for (const rec of failed) {
      await prisma.messageRecipient.update({
        where: { id: rec.id },
        data: { status: "PENDING" },
      });
    }

    return { retried: failed.length };
  }

  async getMessageDeliveryStats(messageId) {
    return prisma.messageRecipient.groupBy({
      by: ["status"],
      where: { messageId },
      _count: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Template Methods
  |--------------------------------------------------------------------------
  */

  async createTemplate(data) {
    return prisma.messageTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: data.channel,
      },
    });
  }

  async updateTemplate(id, data) {
    return prisma.messageTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: data.channel,
      },
    });
  }

  async deleteTemplate(id) {
    return prisma.messageTemplate.delete({
      where: { id },
    });
  }

  async getTemplates() {
    return prisma.messageTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getTemplateById(id) {
    return prisma.messageTemplate.findUnique({
      where: { id },
    });
  }
}

module.exports = new CommunicationService();
