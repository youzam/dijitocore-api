const express = require('express');
const router = express.Router();

const controller = require('./security.controller');
const auth = require('../../../middlewares/auth.middleware');
const requirePermission = require('../../../middlewares/permission.middleware');
const validate = require('../../../middlewares/validate.middleware');
const validation = require('./security.validation');

const PERMISSIONS = require('../../../utils/permission.constants');

/**
 * =====================================================
 * APPLY AUTH
 * =====================================================
 */
router.use(auth);

/**
 * =====================================================
 * LOGIN ACTIVITY
 * =====================================================
 */

router.get(
  '/login-activities',
  requirePermission(PERMISSIONS.SECURITY_LOGINACTIVITY_READ_SYSTEM),
  validate(validation.getLoginActivities),
  controller.getLoginActivities,
);

/**
 * =====================================================
 * AUDIT LOGS
 * =====================================================
 */

router.get(
  '/audit-logs',
  requirePermission(PERMISSIONS.SECURITY_AUDITLOG_READ_SYSTEM),
  validate(validation.getAuditLogs),
  controller.getAuditLogs,
);

router.get(
  '/audit-logs/:id',
  requirePermission(PERMISSIONS.SECURITY_AUDITLOGBYID_READ_SYSTEM),
  validate(validation.auditIdParam),
  controller.getAuditLogById,
);

/**
 * =====================================================
 * USER SESSIONS
 * =====================================================
 */

router.get(
  '/users/:userId/sessions',
  requirePermission(PERMISSIONS.SECURITY_USERSESSION_READ_SYSTEM),
  validate(validation.userIdParam),
  validate(validation.paginationQuery),
  controller.getUserSessions,
);

router.patch(
  '/users/sessions/:tokenId/revoke',
  requirePermission(PERMISSIONS.SECURITY_TOKENREVOKE_EXECUTE_SYSTEM),
  validate(validation.tokenIdParam),
  controller.revokeUserSession,
);

router.patch(
  '/users/:userId/sessions/revoke-all',
  requirePermission(PERMISSIONS.SECURITY_USERSESSIONREVOKEALL_EXECUTE_SYSTEM),
  validate(validation.userIdParam),
  controller.revokeAllUserSessions,
);

/**
 * =====================================================
 * ADMIN SESSIONS
 * =====================================================
 */

router.get(
  '/admins/:adminId/sessions',
  requirePermission(PERMISSIONS.SECURITY_ADMINSESSION_READ_SYSTEM),
  validate(validation.adminIdParam),
  validate(validation.paginationQuery),
  controller.getAdminSessions,
);

router.patch(
  '/admins/sessions/:tokenId/revoke',
  requirePermission(PERMISSIONS.SECURITY_TOKENREVOKE_EXECUTE_SYSTEM),
  validate(validation.tokenIdParam),
  controller.revokeAdminSession,
);

router.patch(
  '/admins/:adminId/sessions/revoke-all',
  requirePermission(PERMISSIONS.SECURITY_ADMINSESSIONREVOKEALL_EXECUTE_SYSTEM),
  validate(validation.adminIdParam),
  controller.revokeAllAdminSessions,
);

/**
 * =====================================================
 * TOKEN CONTROL
 * =====================================================
 */

router.patch(
  '/tokens/:tokenId/revoke',
  requirePermission(PERMISSIONS.SECURITY_TOKENREVOKE_EXECUTE_SYSTEM),
  validate(validation.tokenIdParam),
  controller.revokeToken,
);

/**
 * =====================================================
 * FRAUD FLAGS
 * =====================================================
 */

router.post(
  '/fraud/user',
  requirePermission(PERMISSIONS.SECURITY_FRAUDFLAG_CREATE_SYSTEM),
  validate(validation.flagUser),
  controller.flagUser,
);

router.post(
  '/fraud/transaction',
  requirePermission(PERMISSIONS.SECURITY_FRAUDFLAG_CREATE_SYSTEM),
  validate(validation.flagTransaction),
  controller.flagTransaction,
);

router.patch(
  '/fraud/:flagId/resolve',
  requirePermission(PERMISSIONS.SECURITY_FRAUDFLAGRESOLVE_EXECUTE_SYSTEM),
  validate(validation.flagIdParam),
  controller.resolveFlag,
);

router.get(
  '/fraud',
  requirePermission(PERMISSIONS.SECURITY_FRAUDFLAG_READ_SYSTEM),
  validate(validation.paginationQuery),
  controller.getFlags,
);

/**
 * =====================================================
 * SUSPICIOUS TRANSACTIONS
 * =====================================================
 */

router.get(
  '/suspicious-transactions',
  requirePermission(PERMISSIONS.SECURITY_SUSPICIOUSTRANSACTION_READ_SYSTEM),
  validate(validation.paginationQuery),
  controller.getSuspiciousTransactions,
);

/**
 * =====================================================
 * INTEGRITY CHECKS
 * =====================================================
 */

router.get(
  '/integrity-checks',
  requirePermission(PERMISSIONS.SECURITY_INTEGRITYCHECK_READ_SYSTEM),
  controller.runIntegrityChecks,
);

/**
 * =====================================================
 * SYSTEM ERROR LOGGING
 * =====================================================
 */

router.post(
  '/errors',
  requirePermission(PERMISSIONS.SECURITY_SYSTEMERROR_CREATE_SYSTEM),
  validate(validation.logSystemError),
  controller.logSystemError,
);

/**
 * =====================================================
 * FORCE LOGOUT
 * =====================================================
 */

router.patch(
  '/users/:userId/force-logout',
  requirePermission(PERMISSIONS.SECURITY_USERFORCELOGOUT_EXECUTE_SYSTEM),
  validate(validation.userIdParam),
  controller.forceLogoutUser,
);

/**
 * =====================================================
 * OVERVIEW
 * =====================================================
 */

router.get(
  '/overview',
  requirePermission(PERMISSIONS.SECURITY_OVERVIEW_READ_SYSTEM),
  controller.getSecurityOverview,
);

/**
 * =====================================================
 * SECURITY INCIDENTS
 * =====================================================
 */

router.post(
  '/incidents',
  requirePermission(PERMISSIONS.SECURITY_INCIDENT_CREATE_SYSTEM),
  controller.createSecurityIncident,
);

router.get(
  '/incidents',
  requirePermission(PERMISSIONS.SECURITY_INCIDENT_READ_SYSTEM),
  validate(validation.getIncidentsQuery),
  controller.getSecurityIncidents,
);

router.get(
  '/incidents/:id',
  requirePermission(PERMISSIONS.SECURITY_INCIDENTBYID_READ_SYSTEM),
  validate(validation.incidentIdParam),
  controller.getSecurityIncidentById,
);

router.patch(
  '/incidents/:id/status',
  requirePermission(PERMISSIONS.SECURITY_INCIDENTSTATUS_UPDATE_SYSTEM),
  validate(validation.updateIncidentStatus),
  controller.updateSecurityIncidentStatus,
);

module.exports = router;
