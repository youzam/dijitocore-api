const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const signToken = (payload) => {
  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiresIn,
  });

  const refreshToken = jwt.sign(
    {
      sub: payload.sub,
      identity_type: payload.identity_type,
      businessId: payload.businessId || null,
      tokenVersion: payload.tokenVersion ?? 0,
    },
    jwtConfig.refreshSecret,
    {
      expiresIn: jwtConfig.refreshExpiresIn,
    },
  );

  return {
    accessToken,
    refreshToken,
  };
};

const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = { signToken, verifyToken };
