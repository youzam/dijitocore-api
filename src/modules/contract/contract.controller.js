const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const response = require('../../utils/response');

const contractService = require('./contract.service');
const generateStatement = require('../../utils/statement.generator');

/* ======================================================
   EXISTING BUSINESS / STAFF CONTROLLERS
   (HAKUNA KILICHOONDOLEWA)
   ====================================================== */

exports.createContract = catchAsync(async (req, res) => {
  const contract = await contractService.createContract(
    req.user.businessId,
    req.body,
    req.user.id,
  );
  return response.success(req, res, contract, 201);
});

exports.activateContract = catchAsync(async (req, res) => {
  const contract = await contractService.activateContract(
    req.user.businessId,
    req.params.id,
    req.user.id,
  );

  return response.success(req, res, contract, 200);
});

exports.getContracts = catchAsync(async (req, res) => {
  const result = await contractService.getContracts({
    businessId: req.user.businessId,
  });

  return response.success(req, res, result, 200);
});

exports.getContractById = catchAsync(async (req, res) => {
  const contract = await contractService.getContractById(
    req.params.id,
    req.user.businessId,
  );

  return response.success(req, res, contract, 200);
});

exports.updateContractDraft = catchAsync(async (req, res) => {
  const contract = await contractService.updateContractDraft(
    req.user.businessId,
    req.params.id,
    req.body,
  );

  return response.success(req, res, contract, 200);
});

/* ================= PATCHED TERMINATE ================= */

exports.terminateContract = catchAsync(async (req, res) => {
  const result = await contractService.terminateContract({
    contractId: req.params.id,
    user: req.user,
    payload: { reason: req.body.reason },
  });

  return response.success(req, res, result, 200);
});

exports.restoreContract = catchAsync(async (req, res) => {
  const contract = await contractService.restoreContract(
    req.params.id,
    req.user,
  );

  return response.success(req, res, contract, 200);
});

exports.completeContract = catchAsync(async (req, res) => {
  const contract = await contractService.completeContract(
    req.params.id,
    req.user,
  );

  return response.success(req, res, contract, 200, 'contract.complete_success');
});

exports.deleteContract = catchAsync(async (req, res) => {
  await contractService.deleteContract(req.params.id, req.user);

  return response.success(req, res, null, 200, 'contract.delete_success');
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
    return next(new AppError('contract.not_found', 404));
  }

  return response.success(req, res, contract, 200);
});

exports.downloadMyContractStatement = catchAsync(async (req, res, next) => {
  const result = await contractService.getCustomerContractForStatement(
    req.params.id,
    req.user,
  );

  if (!result) {
    return next(new AppError('contract.not_found', 404));
  }

  const pdf = generateStatement(result);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
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

exports.amendContract = catchAsync(async (req, res) => {
  const contract = await contractService.amendContract(
    req.params.id,
    req.body,
    req.user,
  );

  return response.success(req, res, contract, 200);
});

exports.getContractAmendments = catchAsync(async (req, res) => {
  const amendments = await contractService.getContractAmendments(
    req.user.businessId,
    req.params.id,
  );

  return response.success(req, res, amendments);
});

exports.getSingleContractAmendment = catchAsync(async (req, res) => {
  const amendment = await contractService.getSingleContractAmendment(
    req.user.businessId,
    req.params.id,
    req.params.amendmentId,
  );

  return response.success(req, res, amendment);
});
