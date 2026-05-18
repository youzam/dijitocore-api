const crypto = require('crypto');
const ms = require('ms');
const env = require('./env');

module.exports = {
  accessSecret: env.auth.accessSecret || crypto.randomBytes(64).toString('hex'),

  refreshSecret:
    env.auth.refreshSecret || crypto.randomBytes(64).toString('hex'),

  accessExpiresIn: env.auth.accessExpiresIn,
  refreshExpiresIn: env.auth.refreshExpiresIn,

  accessExpiresInMs: ms(env.auth.accessExpiresIn),
  refreshExpiresInMs: ms(env.auth.refreshExpiresIn),
};
