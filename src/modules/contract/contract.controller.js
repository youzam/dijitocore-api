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

exports.terminateContract = catchAsync(async (req, res) => {
  const contract = await contractService.terminateContract(
    req.params.id,
    req.user,
  );

  return response.success(
    req,
    res,
    contract,
    200,
    "contract.terminate.success",
  );
});

exports.completeContract = catchAsync(async (req, res) => {
  const contract = await contractService.completeContract(
    req.params.id,
    req.user,
  );

  return response.success(req, res, contract, 200, "contract.complete.success");
});

exports.deleteContract = catchAsync(async (req, res) => {
  await contractService.deleteContract(req.params.id, req.user);

  return response.success(req, res, null, 200, "contract.delete.success");
});

/* ======================================================
   CUSTOMER PORTAL CONTROLLERS (MODULE 8)
   READ ONLY
   ====================================================== */

/**
 * CUSTOMER: Get my contracts
 */
exports.getMyContracts = catchAsync(async (req, res) => {
  const contracts = await contractService.getCustomerContracts(req.user);

  return response.success(
    req,
    res,
    contracts,
    200,
    "customer.contracts.fetch.success",
  );
});

/**
 * CUSTOMER: Get my single contract
 */
exports.getMyContractById = catchAsync(async (req, res, next) => {
  const contract = await contractService.getCustomerContractById({
    contractId: req.params.id,
    customerId: req.user.id,
  });

  if (!contract) {
    return next(new AppError("customer.contract.not_found", 404));
  }

  return response.success(
    req,
    res,
    contract,
    200,
    "customer.contract.fetch.success",
  );
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
