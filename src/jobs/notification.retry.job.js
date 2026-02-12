const {
  retryNotifications,
} = require("../services/notifications/notification.service");

module.exports.start = () => {
  setInterval(retryNotifications, 5 * 60 * 1000);
};
