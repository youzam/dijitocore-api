const express = require('express');
const router = express.Router();

const contractController = require('./contract.controller');
const validate = require('../../middlewares/validate.middleware');
const contractValidation = require('./contract.validation');

const auth = require('../../middlewares/auth.middleware');
const tenant = require('../../middlewares/tenant.middleware');
const role = require('../../middlewares/role.middleware');
const subscriptionFeature = require('../../middlewares/subscriptionFeature.middleware');

router.use(auth);
router.use(tenant);

/* CREATE */
router.post(
  '/',
  role(['BUSINESS_OWNER', 'MANAGER']),
  validate(contractValidation.createContract),
  contractController.createContract,
);

router.post(
  '/:id/activate',
  role(['BUSINESS_OWNER', 'MANAGER']),
  contractController.activateContract,
);

/* LIST */
router.get(
  '/',
  role(['BUSINESS_OWNER', 'MANAGER', 'STAFF']),
  contractController.getContracts,
);

/* SINGLE */
router.get(
  '/:id',
  role(['BUSINESS_OWNER', 'MANAGER', 'STAFF']),
  contractController.getContractById,
);

/* UPDATE */
router.patch(
  '/:id',
  role(['BUSINESS_OWNER', 'MANAGER']),
  validate(contractValidation.updateContract),
  contractController.updateContractDraft,
);

/* TERMINATE */
router.post(
  '/:id/terminate',
  role(['BUSINESS_OWNER']),
  validate(contractValidation.terminateContract),
  contractController.terminateContract,
);

/* APPROVE TERMINATION */
router.post(
  '/termination/:approvalId/approve',
  role(['BUSINESS_OWNER']),
  validate(contractValidation.approveTermination),
  contractController.approveTermination,
);

/* REJECT TERMINATION */
router.post(
  '/termination/:approvalId/reject',
  role(['BUSINESS_OWNER']),
  validate(contractValidation.rejectTermination),
  contractController.rejectTermination,
);

/* COMPLETE */
router.post(
  '/:id/complete',
  role(['BUSINESS_OWNER']),
  contractController.completeContract,
);

/* DELETE (soft) */
router.delete(
  '/:id',
  role(['BUSINESS_OWNER']),
  contractController.deleteContract,
);

/* ===========================
   CUSTOMER PORTAL ROUTES
   =========================== */

router.get(
  '/customer/my-contracts',
  role(['CUSTOMER']),
  subscriptionFeature('allowCustomerPortal'),
  contractController.getMyContracts,
);

router.get(
  '/customer/my-contracts/:id',
  role(['CUSTOMER']),
  subscriptionFeature('allowCustomerPortal'),
  contractController.getMyContractById,
);

router.get(
  '/customer/my-contracts/:id/statement',
  role(['CUSTOMER']),
  subscriptionFeature('allowCustomerPortal'),
  contractController.downloadMyContractStatement,
);

router.post(
  '/:id/amend',
  role(['BUSINESS_OWNER']),
  validate(contractValidation.amendContract),
  contractController.amendContract,
);

router.get(
  '/:id/amendments',
  role(['BUSINESS_OWNER']),
  contractController.getContractAmendments,
);

router.get(
  '/amendments/:amendmentId',
  role(['BUSINESS_OWNER']),
  contractController.getSingleContractAmendment,
);

module.exports = router;
