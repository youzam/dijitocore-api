const catchAsync = require('../../../utils/catchAsync');
const response = require('../../../utils/response');

const governanceService = require('./governance.service');

/*
|--------------------------------------------------------------------------
| EXISTING CONTROLLER FUNCTIONS (UNCHANGED FROM ZIP)
|--------------------------------------------------------------------------
*/

exports.activateBusiness = catchAsync(async (req, res) => {
  const data = await governanceService.updateBusinessStatus(
    req.params.businessId,
    'ACTIVE',
  );

  return response.success(req, res, data, 200, 'governance.business_activated');
});

exports.moveToGrace = catchAsync(async (req, res) => {
  const data = await governanceService.updateBusinessStatus(
    req.params.businessId,
    'GRACE',
  );

  return response.success(req, res, data, 200, 'governance.business_grace');
});

exports.suspendBusiness = catchAsync(async (req, res) => {
  const data = await governanceService.updateBusinessStatus(
    req.params.businessId,
    'SUSPENDED',
  );

  return response.success(req, res, data, 200, 'governance.business_suspended');
});

exports.terminateBusiness = catchAsync(async (req, res) => {
  const data = await governanceService.updateBusinessStatus(
    req.params.businessId,
    'TERMINATED',
  );

  return response.success(
    req,
    res,
    data,
    200,
    'governance.business_terminated',
  );
});

/*
|--------------------------------------------------------------------------
| NEW BUSINESS GOVERNANCE FUNCTIONS
|--------------------------------------------------------------------------
*/

exports.listBusinesses = catchAsync(async (req, res) => {
  const data = await governanceService.listBusinesses(req.query);

  return response.success(req, res, data, 200, 'governance.business_list');
});

exports.getBusinessTimeline = catchAsync(async (req, res) => {
  const data = await governanceService.getBusinessTimeline(
    req.params.businessId,
  );

  return response.success(req, res, data, 200, 'governance.business_timeline');
});

exports.getBusinessRevenueSummary = catchAsync(async (req, res) => {
  const data = await governanceService.getBusinessRevenueSummary(
    req.params.businessId,
  );

  return response.success(
    req,
    res,
    data,
    200,
    'governance.business_revenue_summary',
  );
});

exports.changeBusinessSubscription = catchAsync(async (req, res) => {
  const { packageId } = req.body;

  const data = await governanceService.changeBusinessSubscription(
    req.params.businessId,
    packageId,
  );

  return response.success(
    req,
    res,
    data,
    200,
    'governance.subscription_changed',
  );
});

exports.extendBusinessGracePeriod = catchAsync(async (req, res) => {
  const { days } = req.body;

  const data = await governanceService.extendBusinessGracePeriod(
    req.params.businessId,
    days,
  );

  return response.success(req, res, data, 200, 'governance.grace_extended');
});

/*
|--------------------------------------------------------------------------
| USER GOVERNANCE
|--------------------------------------------------------------------------
*/

exports.listUsers = catchAsync(async (req, res) => {
  const data = await governanceService.listUsers(req.query);

  return response.success(req, res, data, 200, 'governance.user_list');
});

exports.lockUser = catchAsync(async (req, res) => {
  const data = await governanceService.lockUser(req.params.userId);

  return response.success(req, res, data, 200, 'governance.user_locked');
});

exports.unlockUser = catchAsync(async (req, res) => {
  const data = await governanceService.unlockUser(req.params.userId);

  return response.success(req, res, data, 200, 'governance.user_unlocked');
});

exports.updateUserStatus = catchAsync(async (req, res) => {
  const { status } = req.body;

  const data = await governanceService.updateUserStatus(
    req.params.userId,
    status,
  );

  return response.success(
    req,
    res,
    data,
    200,
    'governance.user_status_updated',
  );
});

exports.forceLogoutUser = catchAsync(async (req, res) => {
  const data = await governanceService.forceLogoutUser(req.params.userId);

  return response.success(req, res, data, 200, 'governance.user_forced_logout');
});

exports.impersonateUser = catchAsync(async (req, res) => {
  const adminId = req.admin.id;

  const data = await governanceService.impersonateUser(
    adminId,
    req.params.userId,
  );

  return response.success(req, res, data, 200, 'governance.user_impersonation');
});

/*
|--------------------------------------------------------------------------
| CUSTOMER GOVERNANCE
|--------------------------------------------------------------------------
*/

exports.getCustomerSummary = catchAsync(async (req, res) => {
  const data = await governanceService.getCustomerSummary(
    req.params.customerId,
  );

  return response.success(req, res, data, 200, 'governance.customer_summary');
});

exports.blacklistCustomer = catchAsync(async (req, res) => {
  const data = await governanceService.blacklistCustomer(req.params.customerId);

  return response.success(
    req,
    res,
    data,
    200,
    'governance.customer_blacklisted',
  );
});

exports.unblacklistCustomer = catchAsync(async (req, res) => {
  const data = await governanceService.unblacklistCustomer(
    req.params.customerId,
  );

  return response.success(
    req,
    res,
    data,
    200,
    'governance.customer_unblacklisted',
  );
});

exports.getBusinessProfile = catchAsync(async (req, res) => {
  const { businessId } = req.params;

  const business = await governanceService.getBusinessProfile(businessId);

  return response.success(
    req,
    res,
    business,
    200,
    'governance.business_profile',
  );
});

/*
|--------------------------------------------------------------------------
| Reset Business User Password
|--------------------------------------------------------------------------
*/

exports.resetUserPassword = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  const result = await governanceService.resetUserPassword(userId, newPassword);

  return response.success(res, res, result);
});

/*
|--------------------------------------------------------------------------
| Admin Audit Logs
|--------------------------------------------------------------------------
*/

exports.listAdminAuditLogs = catchAsync(async (req, res) => {
  const logs = await governanceService.listAdminAuditLogs(req.query);

  return response.success(res, logs);
});

/*
|--------------------------------------------------------------------------
| Governance Risk Indicators
|--------------------------------------------------------------------------
*/

exports.getRiskFlags = catchAsync(async (req, res) => {
  const data = await governanceService.getRiskFlags();

  return response.success(res, data);
});

exports.globalSearch = catchAsync(async (req, res) => {
  const data = await governanceService.globalSearch(req.query, {
    req,
    resource: req.query.resource, // optional override
  });

  return response.success(req, res, data, 200, 'governance.search_success');
});

/*
|--------------------------------------------------------------------------
| Security Lock and Unlock user
|--------------------------------------------------------------------------
*/
exports.lockUser = catchAsync(async (req, res) => {
  const { userId, durationMs } = req.body;

  const data = await governanceService.lockUser({
    userId,
    durationMs,
    actorId: req.auth.userId,
  });

  return response.success(req, res, data);
});

exports.unlockUser = catchAsync(async (req, res) => {
  const { userId } = req.body;

  const data = await governanceService.unlockUser({
    userId,
    actorId: req.auth.userId,
  });

  return response.success(req, res, data);
});
