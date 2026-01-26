require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  baseDomainCom: process.env.BASE_DOMAIN_COM,
  baseDomainTz: process.env.BASE_DOMAIN_TZ,
};
