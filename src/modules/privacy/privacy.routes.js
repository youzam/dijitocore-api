const express = require('express');
const router = express.Router();

const controller = require('./privacy.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const privacyValidation = require('./privacy.validation');

router.post(
  '/requests',
  auth,
  validate(privacyValidation.createDataRequest),
  controller.createDataRequest,
);
router.get('/requests', auth, controller.getMyDataRequests);
router.get('/requests/:id', auth, controller.getMyDataRequestById);

router.get('/consents', auth, controller.getMyConsents);
router.get('/data-requests/:id/download', auth, controller.downloadExport);

module.exports = router;
