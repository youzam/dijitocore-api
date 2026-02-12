const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

exports.send = async ({ recipient, message }) => {
  if (!recipient) return;

  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${recipient}`,
    body: message,
  });
};
