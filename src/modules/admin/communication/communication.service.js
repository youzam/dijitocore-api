const prisma = require("../../config/prisma");
const notificationService = require("../../services/notifications/notification.service");

class CommunicationService {
  /*
  |--------------------------------------------------------------------------
  | Announcement Methods (UNCHANGED)
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
      data,
    });
  }

  async deleteAnnouncement(id) {
    return prisma.announcement.delete({ where: { id } });
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
    return prisma.announcement.findUnique({ where: { id } });
  }

  /*
  |--------------------------------------------------------------------------
  | Messaging Methods (ENTERPRISE INTEGRATION)
  |--------------------------------------------------------------------------
  */

  async resolveRecipients(target = {}) {
    const where = {};

    // ACTIVE / INACTIVE / BLACKLISTED
    if (target.userStatus === "ACTIVE") {
      where.isActive = true;
    }

    if (target.userStatus === "INACTIVE") {
      where.isActive = false;
    }

    if (target.blacklisted !== undefined) {
      where.isBlacklisted = target.blacklisted;
    }

    // COUNTRY
    if (target.country) {
      where.country = target.country;
    }

    // BUSINESS LOGIC
    if (target.businessOwnersOnly || target.subscriptionPackageId) {
      where.business = {};

      if (target.businessOwnersOnly) {
        where.role = "OWNER";
      }

      if (target.subscriptionPackageId) {
        where.business.subscription = {
          packageId: target.subscriptionPackageId,
          status: "ACTIVE",
        };
      }
    }

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        businessId: true,
      },
    });
  }

  async sendBroadcast(data, adminId) {
    const users = await this.resolveRecipients(data.target);

    const message = await prisma.message.create({
      data: {
        title: data.title,
        body: data.body,
        createdBy: adminId,
      },
    });

    const recipientData = [];

    for (const user of users) {
      recipientData.push({
        messageId: message.id,
        userId: user.id,
        status: "PENDING",
      });

      // 🔥 MULTI CHANNEL LOOP
      for (const channel of data.channels) {
        await notificationService.createNotification({
          businessId: user.businessId,
          userId: user.id,
          type: "ADMIN_BROADCAST",
          channel,
          titleKey: data.title,
          messageKey: data.body,
          locale: "en",
          recipient: user.email || user.phone,
        });
      }
    }

    /*
  |--------------------------------------------------------------------------
  | CUSTOM RECIPIENTS (NO USER RECORD)
  |--------------------------------------------------------------------------
  */

    if (data.customRecipients) {
      const { emails = [], phones = [] } = data.customRecipients;

      for (const email of emails) {
        for (const channel of data.channels) {
          await notificationService.createNotification({
            channel,
            recipient: email,
            type: "CUSTOM",
            titleKey: data.title,
            messageKey: data.body,
          });
        }
      }

      for (const phone of phones) {
        for (const channel of data.channels) {
          await notificationService.createNotification({
            channel,
            recipient: phone,
            type: "CUSTOM",
            titleKey: data.title,
            messageKey: data.body,
          });
        }
      }
    }

    if (recipientData.length) {
      await prisma.messageRecipient.createMany({ data: recipientData });
    }

    return {
      messageId: message.id,
      totalUsers: users.length,
    };
  }

  async sendBatch(data, adminId) {
    const users = await prisma.user.findMany({
      where: { id: { in: data.userIds } },
      select: {
        id: true,
        email: true,
        phone: true,
        businessId: true,
      },
    });

    const message = await prisma.message.create({
      data: {
        title: data.title,
        body: data.body,
        channel: data.channel,
        createdBy: adminId,
      },
    });

    const recipientData = [];

    for (const user of users) {
      recipientData.push({
        messageId: message.id,
        userId: user.id,
        status: "PENDING",
      });

      await notificationService.createNotification({
        businessId: user.businessId,
        userId: user.id,
        type: "ADMIN_BATCH",
        channel: data.channel,
        titleKey: data.title,
        messageKey: data.body,
        locale: "en",
        recipient: user.email || user.phone,
      });
    }

    if (recipientData.length) {
      await prisma.messageRecipient.createMany({
        data: recipientData,
      });
    }

    return {
      messageId: message.id,
      totalRecipients: users.length,
    };
  }

  async retryFailedMessages(messageId) {
    // 👉 reuse notification engine
    return notificationService.retryNotifications();
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
  | Template Methods (UNCHANGED)
  |--------------------------------------------------------------------------
  */

  async createTemplate(data) {
    return prisma.messageTemplate.create({ data });
  }

  async updateTemplate(id, data) {
    return prisma.messageTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id) {
    return prisma.messageTemplate.delete({ where: { id } });
  }

  async getTemplates() {
    return prisma.messageTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getTemplateById(id) {
    return prisma.messageTemplate.findUnique({ where: { id } });
  }
}

module.exports = new CommunicationService();
