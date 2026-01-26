const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwt");

/**
 * =====================================================
 * SIGN TOKENS (ACCESS + REFRESH)
 * =====================================================
 */
const signToken = (payload) => {
  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiresIn,
  });

  const refreshToken = jwt.sign({ sub: payload.sub }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * =====================================================
 * VERIFY TOKEN (USED INTERNALLY)
 * =====================================================
 */
const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = { signToken, verifyToken };
