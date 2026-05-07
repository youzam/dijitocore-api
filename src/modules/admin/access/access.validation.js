const Joi = require('joi');

/**
 * Bootstrap system validation
 * POST /admin/access/bootstrap
 */
const bootstrapSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().min(8).max(64).required(),
});

/**
 * Admin login validation
 * POST /admin/access/login
 */
const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().required(),
});

/**
 * Create admin validation
 * POST /admin/access/admins
 */
const createAdminSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().min(8).max(64).required(),

  role: Joi.string().required(),
});

/**
 * Update admin validation
 * PATCH /admin/access/admins/:id
 */
const updateAdminSchema = Joi.object({
  email: Joi.string().email().optional(),

  role: Joi.string().optional(),

  status: Joi.string().valid('ACTIVE', 'SUSPENDED').optional(),
});

/**
 * Change password validation
 * PATCH /admin/access/change-password
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),

  newPassword: Joi.string().min(8).max(64).required(),
});

/**
 * Update profile validation
 * PATCH /admin/access/me
 */
const updateProfileSchema = Joi.object({
  email: Joi.string().email().optional(),
});

/**
 * Change admin role validation
 * PATCH /admin/access/admins/:id/role
 */
const changeRoleSchema = Joi.object({
  role: Joi.string().required(),
});

module.exports = {
  bootstrapSchema,
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  changePasswordSchema,
  updateProfileSchema,
  changeRoleSchema,
};
