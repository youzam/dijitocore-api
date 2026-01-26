const crypto = require("crypto");

module.exports = {
  accessSecret:
    process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString("hex"),
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString("hex"),
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
};
