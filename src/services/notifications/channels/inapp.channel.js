module.exports.send = async ({ notification }) => {
  // already saved by createNotification
  return {
    success: true,
    channel: 'IN_APP',
    notificationId: notification.id,
  };
};
