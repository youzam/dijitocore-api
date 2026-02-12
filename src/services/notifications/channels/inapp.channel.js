/**
 * In-app notifications are already persisted via Notification table.
 * This channel just acknowledges delivery.
 */
module.exports.send = async ({ recipient, title, message }) => {
  return {
    success: true,
    channel: "IN_APP",
  };
};
