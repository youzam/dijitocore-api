const {
  retryNotifications,
} = require("../services/notifications/notification.service");

/**
 * Retry failed notifications
 * Runs hourly
 */
async function run() {
  try {
    await retryNotifications();
  } catch (error) {
    throw error; // Let jobRunner handle centralized logging
  }
}

module.exports = { run };
