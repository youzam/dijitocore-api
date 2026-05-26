const prisma = require('../../../config/prisma');
const sgMail = require('@sendgrid/mail');
const env = require('../../../config/env');

if (env.email.sendgridKey) {
  sgMail.setApiKey(env.email.sendgridKey);
}

const resolveRecipient = async ({ to, recipient, notification }) => {
  if (to) return to;
  if (recipient) return recipient;
  if (notification?.metadata?.email) return notification.metadata.email;
  if (notification?.metadata?.recipient) return notification.metadata.recipient;

  if (notification?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true },
    });

    return user?.email || null;
  }

  if (notification?.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: notification.customerId },
      select: { email: true },
    });

    return customer?.email || null;
  }

  return null;
};

const resolveSubject = ({ subject, title, notification }) => {
  return subject || title || notification?.title || 'DijitoPay Notification';
};

const resolveBody = ({ body, message, notification }) => {
  return body || message || notification?.message || '';
};

const send = async ({
  to,
  recipient,
  subject,
  title,
  body,
  message,
  notification,
}) => {
  const email = await resolveRecipient({ to, recipient, notification });

  if (!email) return;

  if (!env.email.sendgridKey) {
    throw new Error('SENDGRID_API_KEY missing');
  }

  const finalSubject = resolveSubject({ subject, title, notification });
  const finalBody = resolveBody({ body, message, notification });

  await sgMail.send({
    to: email,
    from: env.email.from,
    subject: finalSubject,
    text: finalBody,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      ${finalBody.replace(/\n/g, '<br />')}
    </div>`,
  });
};

module.exports = { send };
