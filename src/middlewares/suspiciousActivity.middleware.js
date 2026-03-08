const prisma = require("../config/prisma");

/*
|--------------------------------------------------------------------------
| Suspicious Activity Middleware
|--------------------------------------------------------------------------
| Logs forbidden / unauthorized admin attempts
|--------------------------------------------------------------------------
*/

async function suspiciousActivity(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return next();
    }

    const originalSend = res.send;

    res.send = async function (body) {
      try {
        if (res.statusCode === 401 || res.statusCode === 403) {
          await prisma.suspiciousActivity.create({
            data: {
              adminId: user.id,
              action: "FORBIDDEN_REQUEST",
              ip: req.ip,
              endpoint: req.originalUrl,
              meta: {
                role: user.role,
                method: req.method,
              },
            },
          });
        }
      } catch (err) {}

      return originalSend.call(this, body);
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = suspiciousActivity;
