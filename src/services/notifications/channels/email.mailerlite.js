const axios = require('axios');
const env = require('../../../config/env');

const send = async ({ to, subject, body, notification }) => {
  const recipient = to || notification?.recipient;

  if (!recipient) return;

  if (!env.email.mailerLiteApiKey) {
    throw new Error('MAILERLITE_API_KEY missing');
  }

  const payload = {
    from: {
      email: env.email.from,
      name: 'DijitoPay',
    },
    to: [
      {
        email: recipient,
      },
    ],
    subject: subject || notification?.title,
    text: body || notification?.message,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      ${(body || notification?.message || '').replace(/\n/g, '<br />')}
    </div>`,
  };

  await axios.post(`${env.email.mailerLiteBaseUrl}/emails`, payload, {
    headers: {
      Authorization: `Bearer ${env.email.mailerLiteApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
};

module.exports = { send };
