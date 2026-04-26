const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");
const securityService = require("./security.service");

/**
 * =====================================================
 * LOGIN ACTIVITY
 * =====================================================
 */

exports.getLoginActivities = catchAsync(async (req, res) => {
  const result = await securityService.getLoginActivities(req.query);
  return response.success(
    req,
    res,
    result,
    200,
    "security.get_login_activities",
  );
});

/**
 * =====================================================
 * AUDIT LOGS
 * =====================================================
 */

exports.getAuditLogs = catchAsync(async (req, res) => {
  const result = await securityService.getAuditLogs(req.query);
  return response.success(req, res, result, 200, "security.get_audit_logs");
});

exports.getAuditLogById = catchAsync(async (req, res) => {
  const result = await securityService.getAuditLogById(req.params.id);
  return response.success(req, res, result, 200, "security.get_audit_log");
});

/**
 * =====================================================
 * USER SESSIONS
 * =====================================================
 */

exports.getUserSessions = catchAsync(async (req, res) => {
  const result = await securityService.getUserSessions(
    req.params.userId,
    req.query,
  );
  return response.success(req, res, result, 200, "security.get_user_sessions");
});

exports.revokeUserSession = catchAsync(async (req, res) => {
  await securityService.revokeUserSession(req.params.tokenId);
  return response.success(req, res, null, 200, "security.revoke_user_session");
});

exports.revokeAllUserSessions = catchAsync(async (req, res) => {
  await securityService.revokeAllUserSessions(req.params.userId);
  return response.success(
    req,
    res,
    null,
    200,
    "security.revoke_all_user_sessions",
  );
});

/**
 * =====================================================
 * ADMIN SESSIONS
 * =====================================================
 */

exports.getAdminSessions = catchAsync(async (req, res) => {
  const result = await securityService.getAdminSessions(
    req.params.adminId,
    req.query,
  );
  return response.success(req, res, result, 200, "security.get_admin_sessions");
});

exports.revokeAdminSession = catchAsync(async (req, res) => {
  await securityService.revokeAdminSession(req.params.tokenId);
  return response.success(req, res, null, 200, "security.revoke_admin_session");
});

exports.revokeAllAdminSessions = catchAsync(async (req, res) => {
  await securityService.revokeAllAdminSessions(req.params.adminId);
  return response.success(
    req,
    res,
    null,
    200,
    "security.revoke_all_admin_sessions",
  );
});

/**
 * =====================================================
 * TOKEN CONTROL
 * =====================================================
 */

exports.revokeToken = catchAsync(async (req, res) => {
  await securityService.revokeToken(req.params.tokenId);
  return response.success(req, res, null, 200, "security.revoke_token");
});

/**
 * =====================================================
 * FRAUD FLAGS
 * =====================================================
 */

exports.flagUser = catchAsync(async (req, res) => {
  const result = await securityService.flagUser(
    req.body.userId,
    req.body.reason,
  );
  return response.success(req, res, result, 201, "security.flag_user");
});

exports.flagTransaction = catchAsync(async (req, res) => {
  const result = await securityService.flagTransaction(
    req.body.transactionId,
    req.body.reason,
  );
  return response.success(req, res, result, 201, "security.flag_transaction");
});

exports.resolveFlag = catchAsync(async (req, res) => {
  const result = await securityService.resolveFlag(req.params.flagId);
  return response.success(req, res, result, 200, "security.resolve_flag");
});

exports.getFlags = catchAsync(async (req, res) => {
  const result = await securityService.getFlags(req.query);
  return response.success(req, res, result, 200, "security.get_flags");
});

/**
 * =====================================================
 * SUSPICIOUS TRANSACTIONS
 * =====================================================
 */

exports.getSuspiciousTransactions = catchAsync(async (req, res) => {
  const result = await securityService.getSuspiciousTransactions(req.query);
  return response.success(
    req,
    res,
    result,
    200,
    "security.get_suspicious_transactions",
  );
});

/**
 * =====================================================
 * INTEGRITY CHECKS
 * =====================================================
 */

exports.runIntegrityChecks = catchAsync(async (req, res) => {
  const result = await securityService.runIntegrityChecks();
  return response.success(
    req,
    res,
    result,
    200,
    "security.run_integrity_checks",
  );
});

/**
 * =====================================================
 * SYSTEM ERROR LOGGING
 * =====================================================
 */

exports.logSystemError = catchAsync(async (req, res) => {
  const result = await securityService.logSystemError(req.body);
  return response.success(req, res, result, 201, "security.log_system_error");
});

/**
 * =====================================================
 * FORCE LOGOUT
 * =====================================================
 */

exports.forceLogoutUser = catchAsync(async (req, res) => {
  await securityService.forceLogoutUser(req.params.userId);
  return response.success(req, res, null, 200, "security.force_logout_user");
});

/**
 * =====================================================
 * SECURITY OVERVIEW
 * =====================================================
 */

exports.getSecurityOverview = catchAsync(async (req, res) => {
  const result = await securityService.getSecurityOverview();

  return response.success(req, res, result, 200, "security.get_overview");
});

/**
 * =====================================================
 * SECURITY INCIDENT MANAGEMENT
 * =====================================================
 */

exports.createSecurityIncident = catchAsync(async (req, res) => {
  const result = await securityService.createSecurityIncident(req.body);

  return response.success(req, res, result, 200, "security.get_incidents");
});

exports.getSecurityIncidents = catchAsync(async (req, res) => {
  const result = await securityService.getSecurityIncidents(req.query);

  return response.success(req, res, result, 200, "security.get_incidents");
});

exports.getSecurityIncidentById = catchAsync(async (req, res) => {
  const result = await securityService.getSecurityIncidentById(req.params.id);

  return response.success(req, res, result, 200, "security.get_incident");
});

exports.updateSecurityIncidentStatus = catchAsync(async (req, res) => {
  const result = await securityService.updateSecurityIncidentStatus(
    req.params.id,
    req.body.status,
  );

  return response.success(
    req,
    res,
    result,
    200,
    "security.update_incident_status",
  );
});
