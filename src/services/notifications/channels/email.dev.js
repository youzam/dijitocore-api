const nodemailer = require('nodemailer');
const env = require('../../../config/env');

const transporter = nodemailer.createTransport({
  host: env.email.mailtrap.host,
  port: env.email.mailtrap.port,
  auth: {
    user: env.email.mailtrap.user,
    pass: env.email.mailtrap.pass,
  },
});

const resolveRecipient = ({ to, recipient, notification }) => {
  return (
    to ||
    recipient ||
    notification?.metadata?.email ||
    notification?.metadata?.recipient ||
    null
  );
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
  const email = resolveRecipient({ to, recipient, notification });

  if (!email) return;

  if (!env.email.mailtrap.user || !env.email.mailtrap.pass) {
    throw new Error('MAILTRAP_USER or MAILTRAP_PASS missing');
  }

  const finalSubject = resolveSubject({ subject, title, notification });
  const finalBody = resolveBody({ body, message, notification });

  await transporter.sendMail({
    from: env.email.from,
    to: email,
    subject: finalSubject,
    text: finalBody,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      ${finalBody.replace(/\n/g, '<br />')}
    </div>`,
  });
};

module.exports = { send };
