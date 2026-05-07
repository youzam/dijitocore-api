const Joi = require('joi');

/*
|--------------------------------------------------------------------------
| COMMON PARAMS
|--------------------------------------------------------------------------
*/
exports.idParam = Joi.object({
  id: Joi.string().required(),
});

/*
|--------------------------------------------------------------------------
| INVITE USER
|--------------------------------------------------------------------------
*/
exports.inviteUser = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('BUSINESS_OWNER', 'ADMIN', 'STAFF').required(),
});

/*
|--------------------------------------------------------------------------
| ACCEPT INVITE
|--------------------------------------------------------------------------
*/
exports.acceptInvite = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

/*
|--------------------------------------------------------------------------
| LIST INVITES
|--------------------------------------------------------------------------
*/
exports.listInvites = Joi.object({
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| LIST USERS
|--------------------------------------------------------------------------
*/
exports.listUsers = Joi.object({
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
*/
exports.updateUser = Joi.object({
  role: Joi.string().valid('ADMIN', 'STAFF').optional(),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED').optional(),
});
