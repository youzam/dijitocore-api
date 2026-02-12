const emailDev = require("./channels/email.dev");
const emailProd = require("./channels/email.prod");
const smsDev = require("./channels/sms.dev");
const smsProd = require("./channels/sms.prod");
const { translate } = require("../../utils/i18n");

const isProd = process.env.NODE_ENV === "production";
const emailChannel = isProd ? emailProd : emailDev;
const smsChannel = isProd ? smsProd : smsDev;

/**
 * PASSWORD RESET EMAIL (LINK-BASED)
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

/**
 * OTP SMS
 */
const sendOtp = async ({ to, locale = "sw", otp }) => {
  const message = translate("notification.otp.message", locale, { otp });
  return smsChannel.send({ to, message });
};

/**
 * EMAIL VERIFICATION (6-digit code)
 */
const sendEmailVerification = async ({ to, locale = "en", code }) => {
  const subject = translate("notification.email_verify.subject", locale);
  const body = translate("notification.email_verify.body", locale, { code });

  return emailChannel.send({ to, subject, body });
};

/**
 * BUSINESS USER INVITE EMAIL
 */
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

/**
 * CUSTOMER WELCOME SMS (SEND BUSINESS CODE)
 */
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

module.exports = {
  sendPasswordReset,
  sendOtp,
  sendEmailVerification,
  sendBusinessInvite,
  sendCustomerWelcome,
};
