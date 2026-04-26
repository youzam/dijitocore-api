const express = require("express");
const router = express.Router();

const controller = require("./security.controller");
const auth = require("../../../middlewares/auth.middleware");
const requirePermission = require("../../../middlewares/permission.middleware");
const validate = require("../../../middlewares/validate.middleware");
const validation = require("./security.validation");

/**
 * =====================================================
 * APPLY AUTH GLOBALLY
 * =====================================================
 */

router.use(auth);

/**
 * =====================================================
 * LOGIN ACTIVITY
 * =====================================================
 */

router.get(
  "/login-activities",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.getLoginActivities),
  controller.getLoginActivities,
);

/**
 * =====================================================
 * AUDIT LOGS
 * =====================================================
 */

router.get(
  "/audit-logs",
  requirePermission({ module: "SECURITY", action: "READ", scope: "ADMIN" }),
  validate(validation.getAuditLogs),
  controller.getAuditLogs,
);

router.get(
  "/audit-logs/:id",
  requirePermission({ module: "SECURITY", action: "READ", scope: "ADMIN" }),
  validate(validation.auditIdParam),
  controller.getAuditLogById,
);

/**
 * =====================================================
 * USER SESSIONS
 * =====================================================
 */

router.get(
  "/users/:userId/sessions",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.userIdParam),
  validate(validation.paginationQuery),
  controller.getUserSessions,
);

router.patch(
  "/users/sessions/:tokenId/revoke",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.tokenIdParam),
  controller.revokeUserSession,
);

router.patch(
  "/users/:userId/sessions/revoke-all",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.userIdParam),
  controller.revokeAllUserSessions,
);

/**
 * =====================================================
 * ADMIN SESSIONS
 * =====================================================
 */

router.get(
  "/admins/:adminId/sessions",
  requirePermission({ module: "SECURITY", action: "READ", scope: "ADMIN" }),
  validate(validation.adminIdParam),
  validate(validation.paginationQuery),
  controller.getAdminSessions,
);

router.patch(
  "/admins/sessions/:tokenId/revoke",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.tokenIdParam),
  controller.revokeAdminSession,
);

router.patch(
  "/admins/:adminId/sessions/revoke-all",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.adminIdParam),
  controller.revokeAllAdminSessions,
);

/**
 * =====================================================
 * TOKEN CONTROL
 * =====================================================
 */

router.patch(
  "/tokens/:tokenId/revoke",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.tokenIdParam),
  controller.revokeToken,
);

/**
 * =====================================================
 * FRAUD FLAGS
 * =====================================================
 */

router.post(
  "/fraud/user",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "WRITE" }),
  validate(validation.flagUser),
  controller.flagUser,
);

router.post(
  "/fraud/transaction",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "WRITE" }),
  validate(validation.flagTransaction),
  controller.flagTransaction,
);

router.patch(
  "/fraud/:flagId/resolve",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.flagIdParam),
  controller.resolveFlag,
);

router.get(
  "/fraud",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.paginationQuery),
  controller.getFlags,
);

/**
 * =====================================================
 * SUSPICIOUS TRANSACTIONS
 * =====================================================
 */

router.get(
  "/suspicious-transactions",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.paginationQuery),
  controller.getSuspiciousTransactions,
);

/**
 * =====================================================
 * INTEGRITY CHECKS
 * =====================================================
 */

router.get(
  "/integrity-checks",
  requirePermission({ module: "SECURITY", action: "READ", scope: "ADMIN" }),
  controller.runIntegrityChecks,
);

/**
 * =====================================================
 * SYSTEM ERROR LOGGING
 * =====================================================
 */

router.post(
  "/errors",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "WRITE" }),
  validate(validation.logSystemError),
  controller.logSystemError,
);

/**
 * =====================================================
 * FORCE LOGOUT
 * =====================================================
 */

router.patch(
  "/users/:userId/force-logout",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.userIdParam),
  controller.forceLogoutUser,
);

/**
 * =====================================================
 * OVERVIEW
 * =====================================================
 */

router.get(
  "/overview",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  controller.getSecurityOverview,
);

/**
 * =====================================================
 * SECURITY INCIDENT MANAGEMENT
 * =====================================================
 */

router.post(
  "/incidents",
  requirePermission({ module: "SECURITY", action: "CREATE", scope: "WRITE" }),
  // validate(createSecurityIncidentSchema),
  controller.createSecurityIncident,
);

router.get(
  "/incidents",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.getIncidentsQuery),
  controller.getSecurityIncidents,
);

router.get(
  "/incidents/:id",
  requirePermission({ module: "SECURITY", action: "READ", scope: "READ" }),
  validate(validation.incidentIdParam),
  controller.getSecurityIncidentById,
);

router.patch(
  "/incidents/:id/status",
  requirePermission({ module: "SECURITY", action: "UPDATE", scope: "ADMIN" }),
  validate(validation.updateIncidentStatus),
  controller.updateSecurityIncidentStatus,
);

module.exports = router;
