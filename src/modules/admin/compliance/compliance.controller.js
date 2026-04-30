const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");
const complianceService = require("./compliance.service");
const exportService = require("../../../services/export.service");
/*
|--------------------------------------------------------------------------
| DATA RETENTION POLICY
|--------------------------------------------------------------------------
*/

exports.createRetentionPolicy = catchAsync(async (req, res) => {
  const data = await complianceService.createRetentionPolicy(
    req.body,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    201,
    "compliance.retention_policy_created",
  );
});

exports.updateRetentionPolicy = catchAsync(async (req, res) => {
  const data = await complianceService.updateRetentionPolicy(
    req.params.id,
    req.body,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.retention_policy_updated",
  );
});

exports.getRetentionPolicyByResource = catchAsync(async (req, res) => {
  const data = await complianceService.getRetentionPolicyByResource(
    req.query.resource,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.retention_policy_fetched",
  );
});

exports.listRetentionPolicies = catchAsync(async (req, res) => {
  const data = await complianceService.listRetentionPolicies(req.query);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.retention_policies_listed",
  );
});

exports.toggleRetentionPolicy = catchAsync(async (req, res) => {
  const data = await complianceService.toggleRetentionPolicy(
    req.params.id,
    req.body.isActive,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.retention_policy_toggled",
  );
});

/*
|--------------------------------------------------------------------------
| POLICY VERSION
|--------------------------------------------------------------------------
*/

exports.listPolicyVersions = catchAsync(async (req, res) => {
  const data = await complianceService.listPolicyVersions(req.params.policyId);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.policy_versions_listed",
  );
});

exports.getPolicyVersionById = catchAsync(async (req, res) => {
  const data = await complianceService.getPolicyVersionById(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.policy_version_fetched",
  );
});

/*
|--------------------------------------------------------------------------
| DATA REQUESTS
|--------------------------------------------------------------------------
*/

exports.listDataRequests = catchAsync(async (req, res) => {
  const data = await complianceService.listDataRequests(req.query);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.data_requests_listed",
  );
});

exports.getDataRequestById = catchAsync(async (req, res) => {
  const data = await complianceService.getDataRequestById(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.data_request_fetched",
  );
});

exports.approveDataRequest = catchAsync(async (req, res) => {
  const data = await complianceService.approveDataRequest(
    req.params.id,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.data_request_approved",
  );
});

exports.rejectDataRequest = catchAsync(async (req, res) => {
  const data = await complianceService.rejectDataRequest(
    req.params.id,
    req.user.id,
  );

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.data_request_rejected",
  );
});

/*
|--------------------------------------------------------------------------
| PURGE QUEUE
|--------------------------------------------------------------------------
*/

exports.listPurgeQueue = catchAsync(async (req, res) => {
  const data = await complianceService.listPurgeQueue(req.query);

  return response.success(req, res, data, 200, "compliance.purge_queue_listed");
});

exports.getPurgeQueueItem = catchAsync(async (req, res) => {
  const data = await complianceService.getPurgeQueueItem(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.purge_queue_item_fetched",
  );
});

exports.retryPurgeJob = catchAsync(async (req, res) => {
  const data = await complianceService.retryPurgeJob(req.params.id);

  return response.success(req, res, data, 200, "compliance.purge_job_retried");
});

/*
|--------------------------------------------------------------------------
| CONSENT LOGS
|--------------------------------------------------------------------------
*/

exports.listConsentLogs = catchAsync(async (req, res) => {
  const data = await complianceService.listConsentLogs(req.query);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.consent_logs_listed",
  );
});

exports.getConsentLogById = catchAsync(async (req, res) => {
  const data = await complianceService.getConsentLogById(req.params.id);

  return response.success(
    req,
    res,
    data,
    200,
    "compliance.consent_log_fetched",
  );
});

exports.downloadExport = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await exportService.downloadExport(id, req.user);

  if (result.type === "url") {
    return response.success(
      req,
      res,
      { url: result.value },
      200,
      "export.ready",
    );
  }

  if (result.type === "stream") {
    res.setHeader("Content-Type", "application/json");
    return result.value.pipe(res);
  }
});
