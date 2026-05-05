const crypto = require("crypto");
const env = require("./env");

module.exports = {
  accessSecret: env.auth.accessSecret || crypto.randomBytes(64).toString("hex"),
  refreshSecret:
    env.auth.refreshSecret || crypto.randomBytes(64).toString("hex"),
  accessExpiresIn: env.auth.accessExpiresIn,
  refreshExpiresIn: env.auth.refreshExpiresIn,
};
