const twilio = require('twilio');
const env = require('../../../config/env');

const client = twilio(env.twilio.accountSid, env.twilio.authToken);

exports.send = async ({ notification, recipient }) => {
  const phone = recipient;

  if (!phone) return;

  return client.messages.create({
    from: env.twilio.whatsappFrom,
    to: `whatsapp:${phone}`,
    body: notification.message,
  });
};
