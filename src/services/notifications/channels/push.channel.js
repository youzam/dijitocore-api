const admin = require("../../../config/firebase");

exports.send = async ({ token, title, body }) => {
  if (!token) return;

  await admin.messaging().send({
    token,
    notification: {
      title,
      body,
    },
  });
};
