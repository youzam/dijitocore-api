// Temporary in-memory flags (DB-backed later)
const flags = {
  ENABLE_CUSTOMER_IMPORT: true,
  ENABLE_SMS_REMINDERS: true,
  ENABLE_CUSTOMER_PORTAL: true,
};

exports.isEnabled = (flag) => {
  return flags[flag] === true;
};
