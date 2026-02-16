const express = require("express");
const router = express.Router();

const contractController = require("./contract.controller");
const validate = require("../../middlewares/validate.middleware");
const contractValidation = require("./contract.validation");

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");

router.use(auth);
router.use(tenant);

/* CREATE */
router.post(
  "/",
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(contractValidation.createContract),
  contractController.createContract,
);

/* LIST */
router.get(
  "/",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  contractController.getContracts,
);

/* SINGLE */
router.get(
  "/:id",
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  contractController.getContractById,
);

/* UPDATE */
router.patch(
  "/:id",
  role(["BUSINESS_OWNER", "MANAGER"]),
  validate(contractValidation.updateContract),
  contractController.updateContract,
);

/* TERMINATE */
router.post(
  "/:id/terminate",
  role(["BUSINESS_OWNER"]),
  validate(contractValidation.terminateContract),
  contractController.terminateContract,
);

/* APPROVE TERMINATION */
router.post(
  "/termination/:approvalId/approve",
  role(["BUSINESS_OWNER"]),
  contractController.approveTermination,
);

/* REJECT TERMINATION */
router.post(
  "/termination/:approvalId/reject",
  role(["BUSINESS_OWNER"]),
  contractController.rejectTermination,
);

/* COMPLETE */
router.post(
  "/:id/complete",
  role(["BUSINESS_OWNER"]),
  contractController.completeContract,
);

/* DELETE (soft) */
router.delete(
  "/:id",
  role(["BUSINESS_OWNER"]),
  contractController.deleteContract,
);

/* ===========================
   CUSTOMER PORTAL ROUTES
   (READ ONLY)
   =========================== */

/* CUSTOMER - LIST MY CONTRACTS */
router.get(
  "/customer/my-contracts",
  role(["CUSTOMER"]),
  contractController.getMyContracts,
);

/* CUSTOMER - SINGLE CONTRACT DETAILS */
router.get(
  "/customer/my-contracts/:id",
  role(["CUSTOMER"]),
  contractController.getMyContractById,
);

/* CUSTOMER – DOWNLOAD STATEMENT */
router.get(
  "/customer/my-contracts/:id/statement",
  role(["CUSTOMER"]),
  contractController.downloadMyContractStatement,
);

router.get(
  "/terminations",
  role(["BUSINESS_OWNER"]),
  contractController.listTerminationApprovals,
);

module.exports = router;
