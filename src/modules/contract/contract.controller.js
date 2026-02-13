const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");
const response = require("../../utils/response");

const contractService = require("./contract.service");
const generateStatement = require("../../utils/statement.generator");

/* ======================================================
   EXISTING BUSINESS / STAFF CONTROLLERS
   (HAKUNA KILICHOONDOLEWA)
   ====================================================== */

exports.createContract = catchAsync(async (req, res) => {
  const contract = await contractService.createContract(req.body, req.user);
  return response.success(req, res, contract, 201, "contract.create.success");
});

exports.getContracts = catchAsync(async (req, res) => {
  const result = await contractService.getContracts(req);
  return response.success(req, res, result, 200, "contract.fetch.success");
});

exports.getContractById = catchAsync(async (req, res, next) => {
  const contract = await contractService.getContractById(
    req.params.id,
    req.user,
  );

  if (!contract) {
    return next(new AppError("contract.not_found", 404));
  }

  return response.success(req, res, contract, 200, "contract.fetch.success");
});

exports.updateContract = catchAsync(async (req, res) => {
  const contract = await contractService.updateContract(
    req.params.id,
    req.body,
    req.user,
  );

  return response.success(req, res, contract, 200, "contract.update.success");
});

/* ================= PATCHED TERMINATE ================= */

exports.terminateContract = catchAsync(async (req, res) => {
  const result = await contractService.terminateContract({
    businessId: req.user.businessId,
    id: req.params.id,
    userId: req.user.id,
    reason: req.body.reason,
  });

  return response.success(req, res, result, 200, "contract.terminate_success");
});

/* ================= NEW: APPROVE TERMINATION ================= */

exports.approveTermination = catchAsync(async (req, res) => {
  const result = await contractService.approveTermination({
    businessId: req.user.businessId,
    approvalId: req.params.approvalId,
    approverId: req.user.id,
  });

  return response.success(
    req,
    res,
    result,
    200,
    "contract.termination_approved",
  );
});

/* ================= NEW: REJECT TERMINATION ================= */

exports.rejectTermination = catchAsync(async (req, res) => {
  const result = await contractService.rejectTermination({
    businessId: req.user.businessId,
    approvalId: req.params.approvalId,
    approverId: req.user.id,
  });

  return response.success(
    req,
    res,
    result,
    200,
    "contract.termination_rejected",
  );
});

exports.completeContract = catchAsync(async (req, res) => {
  const contract = await contractService.completeContract(
    req.params.id,
    req.user,
  );

  return response.success(req, res, contract, 200, "contract.complete_success");
});

exports.deleteContract = catchAsync(async (req, res) => {
  await contractService.deleteContract(req.params.id, req.user);

  return response.success(req, res, null, 200, "contract.delete_success");
});

/* ======================================================
   CUSTOMER PORTAL CONTROLLERS (MODULE 8)
   READ ONLY
   ====================================================== */

exports.getMyContracts = catchAsync(async (req, res) => {
  const contracts = await contractService.getCustomerContracts(req.user);

  return response.success(req, res, contracts, 200);
});

exports.getMyContractById = catchAsync(async (req, res, next) => {
  const contract = await contractService.getCustomerContractById({
    contractId: req.params.id,
    customerId: req.user.id,
  });

  if (!contract) {
    return next(new AppError("contract.not_found", 404));
  }

  return response.success(req, res, contract, 200);
});

exports.downloadMyContractStatement = catchAsync(async (req, res, next) => {
  const result = await contractService.getCustomerContractForStatement(
    req.params.id,
    req.user,
  );

  if (!result) {
    return next(new AppError("contract.not_found", 404));
  }

  const pdf = generateStatement(result);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=statement-${result.contract.contractNumber}.pdf`,
  );

  pdf.pipe(res);
});

exports.listTerminationApprovals = catchAsync(async (req, res) => {
  const approvals = await contractService.listTerminationApprovals({
    businessId: req.user.businessId,
    status: req.query.status,
  });

  return response.success(req, res, approvals, 200);
});
