const emailDev = require("./channels/email.dev");
const emailProd = require("./channels/email.prod");
const smsDev = require("./channels/sms.dev");
const smsProd = require("./channels/sms.prod");
const { translate } = require("../../utils/i18n");
const prisma = require("../../config/prisma");
const auditService = require("../audit/audit.service");

const inAppChannel = require("./channels/inapp.channel");
const pushChannel = require("./channels/push.channel");
const whatsappChannel = require("./channels/whatsapp.channel");

const subscriptionAuthority = require("../../modules/subscription/subscription.authority.service");

const isProd = process.env.NODE_ENV !== "development";
const emailChannel = isProd ? emailProd : emailDev;
const smsChannel = isProd ? smsProd : smsDev;

const CHANNEL_MAP = {
  IN_APP: inAppChannel,
  PUSH: pushChannel,
  SMS: smsChannel,
  WHATSAPP: whatsappChannel,
  EMAIL: emailChannel,
};

const MAX_NOTIFICATION_RETRIES = 3;

/**
 * =====================================================
 * INTERNAL HELPERS (USING EXISTING MODELS ONLY)
 * =====================================================
 */

const getNotificationSetting = async ({ businessId, userId }) => {
  // 1️⃣ user-level override
  if (userId) {
    const userSetting = await prisma.notificationSetting.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    });

    if (userSetting) return userSetting;
  }

  // 2️⃣ business-level fallback
  return prisma.notificationSetting.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: null,
      },
    },
  });
};

const isWithinQuietHours = (setting) => {
  if (!setting.quietHoursStart || !setting.quietHoursEnd) return false;

  const now = new Date();
  const current = now.toTimeString().slice(0, 5); // HH:mm

  return current >= setting.quietHoursStart && current <= setting.quietHoursEnd;
};

/**
 * =====================================================
 * EXISTING FUNCTIONS (UNCHANGED)
 * =====================================================
 */

const sendPasswordReset = async ({ to, locale = "en", resetUrl }) => {
  const subject = translate("notification.password_reset.subject", locale);
  const body = translate("notification.password_reset.body", locale, {
    resetUrl,
  });

  return emailChannel.send({
    to,
    subject,
    body,
  });
};

const sendOtp = async ({ to, locale = "sw", otp }) => {
  const message = translate("notification.otp.message", locale, { otp });
  return smsChannel.send({ to, message });
};

const sendEmailVerification = async ({ to, locale = "en", code }) => {
  const subject = translate("notification.email_verify.subject", locale);
  const body = translate("notification.email_verify.body", locale, { code });

  return emailChannel.send({ to, subject, body });
};

const sendBusinessInvite = async ({ to, locale = "en", inviteUrl, role }) => {
  const subject = translate("notification.business_invite.subject", locale);
  const body = translate("notification.business_invite.body", locale, {
    inviteUrl,
    role,
  });

  return emailChannel.send({
    to,
    subject,
    body,
  });
};

const sendCustomerWelcome = async ({
  phone,
  businessName,
  businessCode,
  locale = "sw",
}) => {
  if (!phone) return;

  const message = translate("customer.welcome_sms", locale, {
    business: businessName,
    code: businessCode,
  });

  return smsChannel.send({ to: phone, message });
};

/**
 * =====================================================
 * MODULE 7 — NOTIFICATION CORE (FINAL)
 * =====================================================
 */

const createNotification = async ({
  businessId,
  userId = null,
  customerId = null,
  contractId = null,
  type,
  channel,
  titleKey,
  messageKey,
  locale = "sw",
  templateVars = {},
  recipient,
}) => {
  const title = translate(titleKey, locale, templateVars);
  const message = translate(messageKey, locale, templateVars);

  // 🔒 Duplicate guard (prevent rapid duplicate spam)
  const recentDuplicate = await prisma.notification.findFirst({
    where: {
      businessId,
      userId,
      customerId,
      contractId,
      type,
      channel,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000),
      },
    },
  });

  if (recentDuplicate) {
    return recentDuplicate;
  }

  const notification = await prisma.notification.create({
    data: {
      businessId,
      userId,
      customerId,
      contractId,
      type,
      channel,
      title,
      message,
      status: "QUEUED",
    },
  });

  try {
    /**
     * 🔐 LOAD NOTIFICATION SETTINGS
     */
    const setting = await getNotificationSetting({ businessId, userId });

    if (setting) {
      if (channel === "IN_APP" && !setting.enableInApp) return notification;
      if (channel === "PUSH" && !setting.enablePush) return notification;
      if (channel === "SMS" && !setting.enableSMS) return notification;
      if (channel === "WHATSAPP" && !setting.enableWhatsApp)
        return notification;
      if (channel === "EMAIL" && !setting.enableEmail) return notification;

      if (type === "OVERDUE" && setting.muteOverdue) return notification;
      if (type === "REMINDER" && setting.muteReminders) return notification;

      if (isWithinQuietHours(setting)) return notification;
    }

    /**
     * 🔔 PUSH — SPECIAL HANDLING
     */
    if (channel === "PUSH") {
      const tokens = await prisma.deviceToken.findMany({
        where: {
          OR: [
            userId ? { userId } : null,
            customerId ? { customerId } : null,
          ].filter(Boolean),
        },
        select: { token: true },
      });

      for (const t of tokens) {
        await pushChannel.send({
          token: t.token,
          title,
          body: message,
        });
      }
    } else {
      /**
       * 📤 OTHER CHANNELS
       */
      const adapter = CHANNEL_MAP[channel];
      if (!adapter) {
        throw new Error(`Unsupported channel: ${channel}`);
      }

      // 🔒 SMS SUBSCRIPTION ENFORCEMENT
      if (channel === "SMS") {
        await subscriptionAuthority.assertActiveSubscription(businessId);
        await subscriptionAuthority.assertFeature(businessId, "allowSMS");
        await subscriptionAuthority.assertMonthlyLimit(
          businessId,
          "maxMonthlySms",
        );
      }

      await adapter.send({
        recipient,
        title,
        message,
      });

      // 📊 TRACK SMS USAGE ONLY AFTER SUCCESS
      if (channel === "SMS") {
        await subscriptionAuthority.trackUsage(businessId, "maxMonthlySms", 1);
      }
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await auditService.log({
      businessId,
      action: "NOTIFICATION_SENT",
      metadata: {
        notificationId: notification.id,
        channel,
        type,
      },
    });

    return notification;
  } catch (err) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        providerResponse: { error: err.message },
      },
    });

    return null;
  }
};

const retryNotifications = async () => {
  const BATCH_SIZE = 200;
  let cursor = null;

  while (true) {
    const failed = await prisma.notification.findMany({
      where: {
        status: "FAILED",
        retryCount: { lt: MAX_NOTIFICATION_RETRIES },
        businessId: { not: null },
      },
      take: BATCH_SIZE,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { id: "asc" },
    });

    if (!failed.length) break;

    for (const n of failed) {
      cursor = n.id;

      try {
        if (n.channel === "PUSH") {
          const tokens = await prisma.deviceToken.findMany({
            where: {
              OR: [
                n.userId ? { userId: n.userId } : null,
                n.customerId ? { customerId: n.customerId } : null,
              ].filter(Boolean),
            },
            select: { token: true },
          });

          for (const t of tokens) {
            await pushChannel.send({
              token: t.token,
              title: n.title,
              body: n.message,
            });
          }
        } else {
          const adapter = CHANNEL_MAP[n.channel];
          if (!adapter) continue;

          await adapter.send({
            recipient: n.customerId || n.userId,
            title: n.title,
            message: n.message,
          });
        }

        await prisma.notification.update({
          where: { id: n.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch (e) {
        await prisma.notification.update({
          where: { id: n.id },
          data: {
            retryCount: { increment: 1 },
            providerResponse: { error: e.message },
          },
        });
      }
    }
  }
};

const markNotificationRead = async ({
  notificationId,
  businessId,
  userId = null,
  customerId = null,
}) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      businessId,
      OR: [
        userId ? { userId } : null,
        customerId ? { customerId } : null,
      ].filter(Boolean),
    },
  });

  if (!notification) {
    throw new Error("notification.not_found_or_unauthorized");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
};

module.exports = {
  // existing
  sendPasswordReset,
  sendOtp,
  sendEmailVerification,
  sendBusinessInvite,
  sendCustomerWelcome,

  // module 7
  createNotification,
  retryNotifications,
  markNotificationRead,
};
