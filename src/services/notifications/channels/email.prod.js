const sgMail = require("@sendgrid/mail");
const env = require("../../../config/env");

sgMail.setApiKey(env.email.sendgridKey);

const send = async ({ to, subject, body }) => {
  await sgMail.send({
    to,
    from: env.email.from,
    subject,
    text: body,
  });
};

module.exports = { send };
