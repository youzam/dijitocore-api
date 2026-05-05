const admin = require("firebase-admin");
const env = require("./env");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = admin;
