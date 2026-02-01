const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");
const contractService = require("./contract.service");

/* CREATE */
exports.createContract = catchAsync(async (req, res) => {
  const contract = await contractService.createContract({
    businessId: req.user.businessId,
    userId: req.user.id,
    payload: req.body,
  });

  return response.success(req, res, contract, 201, "contract.created");
});

/* LIST */
exports.getContracts = catchAsync(async (req, res) => {
  const contracts = await contractService.getContracts({
    businessId: req.user.businessId,
  });

  return response.success(req, res, contracts, 200, "contract.list");
});

/* SINGLE */
exports.getContractById = catchAsync(async (req, res) => {
  const contract = await contractService.getContractById({
    businessId: req.user.businessId,
    id: req.params.id,
  });

  return response.success(req, res, contract, 200, "contract.single");
});

/* UPDATE */
exports.updateContract = catchAsync(async (req, res) => {
  const contract = await contractService.updateContract({
    businessId: req.user.businessId,
    id: req.params.id,
    payload: req.body,
  });

  return response.success(req, res, contract, 200, "contract.updated");
});

/* TERMINATE */
exports.terminateContract = catchAsync(async (req, res) => {
  await contractService.terminateContract({
    businessId: req.user.businessId,
    id: req.params.id,
    userId: req.user.id,
    reason: req.body.reason,
  });

  return response.success(req, res, null, 200, "contract.terminated");
});

/* COMPLETE */
exports.completeContract = catchAsync(async (req, res) => {
  await contractService.completeContract({
    businessId: req.user.businessId,
    id: req.params.id,
  });

  return response.success(req, res, null, 200, "contract.completed");
});

/* DELETE */
exports.deleteContract = catchAsync(async (req, res) => {
  await contractService.softDeleteContract({
    businessId: req.user.businessId,
    id: req.params.id,
  });

  return response.success(req, res, null, 200, "contract.deleted");
});
