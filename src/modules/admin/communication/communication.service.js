const prisma = require("../../config/prisma");
const notificationService = require("../../services/notifications/notification.service");
const { logAudit } = require("../../utils/audit.helper");

class CommunicationService {
  /*
  |--------------------------------------------------------------------------
  | CREATE ANNOUNCEMENT (ADVANCED)
  |--------------------------------------------------------------------------
  */
  async createAnnouncement(data, adminId) {
    const {
      title,
      message,
      priority,
      placement,
      eventType,
      startAt,
      endAt,
      countries,
      packages,
      segments,
      trialOnly,
      isEmergency,
      sendNotification,
      channels,
    } = data;

    if (!title || !message || !priority || !placement) {
      throw new Error("announcement.invalid_data");
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message,
        priority,
        placement,
        eventType: eventType || "GENERAL",
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        trialOnly: trialOnly || false,
        isEmergency: isEmergency || false,
        sendNotification: sendNotification || false,
        channels: channels || [],
        createdBy: adminId,

        countries: {
          create: (countries || []).map((c) => ({
            countryCode: c,
          })),
        },

        packages: {
          create: (packages || []).map((p) => ({
            packageId: p,
          })),
        },

        segments: {
          create: (segments || []).map((s) => ({
            segmentType: s.type,
            rules: s.rules || {},
          })),
        },
      },
      include: {
        countries: true,
        packages: true,
        segments: true,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | OPTIONAL NOTIFICATION TRIGGER
    |--------------------------------------------------------------------------
    */
    if (sendNotification && channels?.length) {
      for (const channel of channels) {
        await notificationService.createNotification({
          type: "ANNOUNCEMENT",
          channel,
          titleKey: title,
          messageKey: message,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | AUDIT
    |--------------------------------------------------------------------------
    */
    await logAudit({
      userId: adminId,
      entityType: "ANNOUNCEMENT",
      entityId: announcement.id,
      action: "ANNOUNCEMENT_CREATED",
      metadata: {
        title,
        priority,
        placement,
        eventType,
      },
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return announcement;
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE ANNOUNCEMENT
  |--------------------------------------------------------------------------
  */
  async updateAnnouncement(id, data, adminId) {
    const { countries, packages, segments, startAt, endAt, ...rest } = data;

    const updated = await prisma.$transaction(async (tx) => {
      /*
    |--------------------------------------------------------------------------
    | UPDATE MAIN ANNOUNCEMENT
    |--------------------------------------------------------------------------
    */
      const announcement = await tx.announcement.update({
        where: { id },
        data: {
          ...rest,
          startAt: startAt ? new Date(startAt) : undefined,
          endAt: endAt ? new Date(endAt) : undefined,
        },
      });

      /*
    |--------------------------------------------------------------------------
    | REPLACE COUNTRIES
    |--------------------------------------------------------------------------
    */
      if (countries) {
        await tx.announcementCountry.deleteMany({
          where: { announcementId: id },
        });

        await tx.announcementCountry.createMany({
          data: countries.map((c) => ({
            announcementId: id,
            countryCode: c,
          })),
        });
      }

      /*
    |--------------------------------------------------------------------------
    | REPLACE PACKAGES
    |--------------------------------------------------------------------------
    */
      if (packages) {
        await tx.announcementPackage.deleteMany({
          where: { announcementId: id },
        });

        await tx.announcementPackage.createMany({
          data: packages.map((p) => ({
            announcementId: id,
            packageId: p,
          })),
        });
      }

      /*
    |--------------------------------------------------------------------------
    | REPLACE SEGMENTS
    |--------------------------------------------------------------------------
    */
      if (segments) {
        await tx.announcementSegment.deleteMany({
          where: { announcementId: id },
        });

        await tx.announcementSegment.createMany({
          data: segments.map((s) => ({
            announcementId: id,
            segmentType: s.type,
            rules: s.rules || {},
          })),
        });
      }

      return announcement;
    });

    /*
  |--------------------------------------------------------------------------
  | AUDIT
  |--------------------------------------------------------------------------
  */
    await logAudit({
      userId: adminId,
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: "ANNOUNCEMENT_UPDATED",
      metadata: {
        updatedFields: Object.keys(data),
      },
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return updated;
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE ANNOUNCEMENT
  |--------------------------------------------------------------------------
  */
  async deleteAnnouncement(id, adminId) {
    const deleted = await prisma.announcement.delete({
      where: { id },
    });

    await logAudit({
      userId: adminId,
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: "ANNOUNCEMENT_DELETED",
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return deleted;
  }

  /*
  |--------------------------------------------------------------------------
  | GET ANNOUNCEMENTS (ADMIN VIEW)
  |--------------------------------------------------------------------------
  */
  async getAnnouncements(filters = {}) {
    const where = {};

    if (filters.priority) where.priority = filters.priority;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.placement) where.placement = filters.placement;

    if (filters.isActive) {
      const now = new Date();
      where.AND = [
        {
          OR: [{ startAt: null }, { startAt: { lte: now } }],
        },
        {
          OR: [{ endAt: null }, { endAt: { gte: now } }],
        },
      ];
    }

    return prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        countries: true,
        packages: true,
        segments: true,
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | GET SINGLE ANNOUNCEMENT
  |--------------------------------------------------------------------------
  */
  async getAnnouncementById(id) {
    return prisma.announcement.findUnique({
      where: { id },
      include: {
        countries: true,
        packages: true,
        segments: true,
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Messaging Methods
  |--------------------------------------------------------------------------
  */

  async resolveRecipients(target = {}) {
    const where = {};

    if (target.userStatus === "ACTIVE") where.isActive = true;
    if (target.userStatus === "INACTIVE") where.isActive = false;

    if (target.blacklisted !== undefined) {
      where.isBlacklisted = target.blacklisted;
    }

    if (target.country) where.country = target.country;

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

    // CUSTOM RECIPIENTS
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
      await prisma.messageRecipient.createMany({
        data: recipientData,
      });
    }

    await logAudit({
      userId: adminId,
      entityType: "MESSAGE",
      entityId: message.id,
      action: "BROADCAST_SENT",
      metadata: {
        totalUsers: users.length,
        channels: data.channels,
      },
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });
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

    await logAudit({
      userId: adminId,
      entityType: "MESSAGE",
      entityId: message.id,
      action: "BATCH_MESSAGE_SENT",
      metadata: {
        totalRecipients: users.length,
        channel: data.channel,
      },
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return {
      messageId: message.id,
      totalRecipients: users.length,
    };
  }

  async retryFailedMessages() {
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
  | Template Methods
  |--------------------------------------------------------------------------
  */

  async createTemplate(data, adminId) {
    const template = await prisma.messageTemplate.create({
      data,
    });

    await logAudit({
      userId: adminId,
      entityType: "TEMPLATE",
      entityId: template.id,
      action: "TEMPLATE_CREATED",
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return template;
  }

  async updateTemplate(id, data, adminId) {
    const updated = await prisma.messageTemplate.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: adminId,
      entityType: "TEMPLATE",
      entityId: id,
      action: "TEMPLATE_UPDATED",
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return updated;
  }

  async deleteTemplate(id, adminId) {
    const deleted = await prisma.messageTemplate.delete({
      where: { id },
    });

    await logAudit({
      userId: adminId,
      entityType: "TEMPLATE",
      entityId: id,
      action: "TEMPLATE_DELETED",
      module: "COMMUNICATION",
      actorType: "ADMIN",
    });

    return deleted;
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
