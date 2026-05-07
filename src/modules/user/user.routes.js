const express = require('express');
const controller = require('./user.controller');

const auth = require('../../middlewares/auth.middleware');
const tenant = require('../../middlewares/tenant.middleware');
const role = require('../../middlewares/role.middleware');
const subscriptionFeature = require('../../middlewares/subscriptionFeature.middleware');
const validate = require('../../middlewares/validate.middleware');

const validation = require('./user.validation');

const router = express.Router();

// INVITE
router.post(
  '/invite',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  subscriptionFeature('allowMultiUser'),
  validate({ body: validation.inviteUser }),
  controller.inviteUser,
);

// ACCEPT
router.post(
  '/accept-invite',
  validate({ body: validation.acceptInvite }),
  controller.acceptInvite,
);

// INVITES
router.get(
  '/invites',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({ query: validation.listInvites }),
  controller.listInvites,
);

router.delete(
  '/invites/:id',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({ params: validation.idParam }),
  controller.revokeInvite,
);

// USERS
router.get(
  '/',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({ query: validation.listUsers }),
  controller.listUsers,
);

router.patch(
  '/:id',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({
    params: validation.idParam,
    body: validation.updateUser,
  }),
  controller.updateUser,
);

router.patch(
  '/:id/activate',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({ params: validation.idParam }),
  controller.activateUser,
);

router.patch(
  '/:id/deactivate',
  auth,
  tenant,
  role(['BUSINESS_OWNER']),
  validate({ params: validation.idParam }),
  controller.deactivateUser,
);

module.exports = router;
