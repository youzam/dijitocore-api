const {
  retryNotifications,
} = require("../services/notifications/notification.service");

/**
 * Retry failed notifications
 * Runs hourly
 */
module.exports = async () => {
  await retryNotifications();
};
