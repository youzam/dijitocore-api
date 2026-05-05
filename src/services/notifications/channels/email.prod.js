const prisma = require('../../../config/prisma');
const sgMail = require('@sendgrid/mail');
const env = require('../../../config/env');

sgMail.setApiKey(env.email.sendgridKey);

const send = async ({ notification }) => {
  let email = null;

  if (notification.userId) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true },
    });
    email = user?.email;
  }

  if (!email && notification.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: notification.customerId },
      select: { email: true },
    });
    email = customer?.email;
  }

  if (!email) return;

  await sgMail.send({
    to: email,
    from: env.email.from,
    subject: notification.title,
    text: notification.message,
  });
};

module.exports = { send };
