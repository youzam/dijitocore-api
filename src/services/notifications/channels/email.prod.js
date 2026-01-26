const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const send = async ({ to, subject, body }) => {
  await sgMail.send({
    to,
    from: process.env.EMAIL_FROM,
    subject,
    text: body,
  });
};

module.exports = { send };
