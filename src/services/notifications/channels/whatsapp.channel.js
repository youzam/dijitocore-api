const twilio = require("twilio");
const env = require("../../../config/env");

const client = twilio(env.twilio.accountSid, env.twilio.authToken);

exports.send = async ({ recipient, message }) => {
  if (!recipient) return;

  return client.messages.create({
    from: env.twilio.whatsappFrom,
    to: `whatsapp:${recipient}`,
    body: message,
  });
};
