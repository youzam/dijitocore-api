const prisma = require("../config/prisma");
const {
  createSecurityIncident,
} = require("../modules/admin/security/security.service");

const INCIDENT_RULES = {
  SUSPICIOUS_TRANSACTION: {
    severity: (event) => {
      if (event.riskScore >= 90) return "CRITICAL";
      if (event.riskScore >= 70) return "HIGH";
      return "MEDIUM";
    },
    dedupeWindowMs: 5 * 60 * 1000,
  },

  AUTH_BRUTE_FORCE: {
    severity: () => "HIGH",
    dedupeWindowMs: 10 * 60 * 1000,
  },

  INVALID_TOKEN: {
    severity: () => "MEDIUM",
    dedupeWindowMs: 2 * 60 * 1000,
  },

  UNAUTHORIZED_ACCESS: {
    severity: () => "HIGH",
    dedupeWindowMs: 5 * 60 * 1000,
  },
  PRIVILEGE_ESCALATION_ATTEMPT: {
    severity: () => "CRITICAL",
    dedupeWindowMs: 5 * 60 * 1000,
  },
  PAYMENT_TAMPERING_ATTEMPT: {
    severity: () => "CRITICAL",
    dedupeWindowMs: 5 * 60 * 1000,
  },
};

exports.handleSecurityEvent = async (event) => {
  const rule = INCIDENT_RULES[event.type];
  if (!rule) return;

  const existing = await prisma.securityIncident.findFirst({
    where: {
      type: event.type,
      referenceId: event.referenceId,
      createdAt: {
        gte: new Date(Date.now() - rule.dedupeWindowMs),
      },
    },
  });

  if (existing) return;

  const severity =
    typeof rule.severity === "function" ? rule.severity(event) : rule.severity;

  await createSecurityIncident({
    type: event.type,
    title: event.title,
    description: event.description,
    severity,
    source: event.source || "SYSTEM",
    referenceId: event.referenceId,
    metadata: event.metadata || null,
  });
};
