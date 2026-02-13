const express = require("express");
const router = express.Router();

const contractController = require("./contract.controller");
const validate = require("../../middlewares/validate.middleware");
const contractValidation = require("./contract.validation");

const auth = require("../../middlewares/auth.middleware");
const tenant = require("../../middlewares/tenant.middleware");
const role = require("../../middlewares/role.middleware");

/* ===========================
   BUSINESS / STAFF ROUTES
   =========================== */

/* CREATE */
router.post(
  "/",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  tenant,
  validate(contractValidation.createContract),
  contractController.createContract,
);

/* LIST */
router.get(
  "/",
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  tenant,
  contractController.getContracts,
);

/* SINGLE */
router.get(
  "/:id",
  auth,
  role(["BUSINESS_OWNER", "MANAGER", "STAFF"]),
  tenant,
  contractController.getContractById,
);

/* UPDATE */
router.patch(
  "/:id",
  auth,
  role(["BUSINESS_OWNER", "MANAGER"]),
  tenant,
  validate(contractValidation.updateContract),
  contractController.updateContract,
);

/* TERMINATE */
router.post(
  "/:id/terminate",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  validate(contractValidation.terminateContract),
  contractController.terminateContract,
);

/* APPROVE TERMINATION */
router.post(
  "/termination/:approvalId/approve",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  contractController.approveTermination,
);

/* REJECT TERMINATION */
router.post(
  "/termination/:approvalId/reject",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  contractController.rejectTermination,
);

/* COMPLETE */
router.post(
  "/:id/complete",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  contractController.completeContract,
);

/* DELETE (soft) */
router.delete(
  "/:id",
  auth,
  role(["BUSINESS_OWNER"]),
  tenant,
  contractController.deleteContract,
);

/* ===========================
   CUSTOMER PORTAL ROUTES
   (READ ONLY)
   =========================== */

/* CUSTOMER - LIST MY CONTRACTS */
router.get(
  "/customer/my-contracts",
  auth,
  role(["CUSTOMER"]),
  contractController.getMyContracts,
);

/* CUSTOMER - SINGLE CONTRACT DETAILS */
router.get(
  "/customer/my-contracts/:id",
  auth,
  role(["CUSTOMER"]),
  contractController.getMyContractById,
);

/* CUSTOMER – DOWNLOAD STATEMENT */
router.get(
  "/customer/my-contracts/:id/statement",
  auth,
  role(["CUSTOMER"]),
  contractController.downloadMyContractStatement,
);

router.get(
  "/terminations",
  auth,
  tenant,
  role(["BUSINESS_OWNER"]),
  contractController.listTerminationApprovals,
);

module.exports = router;
