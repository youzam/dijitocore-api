const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

const dashboardService = require("./dashboard.service");
const analyticsService = require("./dashboard.analytics.service");
const subscriptionAuthority = require("../subscription/subscription.authority.service");

/**
 * ===============================
 * ENTERPRISE DASHBOARD
 * ===============================
 */
exports.getEnterpriseDashboard = catchAsync(async (req, res) => {
  const { businessId, role, id: userId } = req.user;

  const [time, staffMetrics, assets, risks, cashflow, funnel, health] =
    await Promise.all([
      dashboardService.getTimeComparisons(businessId),
      dashboardService.getStaffMetrics(businessId),
      dashboardService.getAssetMetrics(businessId),
      dashboardService.getRiskContracts(businessId),
      dashboardService.getCashflow(businessId),
      dashboardService.getFunnelMetrics(businessId),
      dashboardService.getHealthScore(businessId),
    ]);

  let payload = {};

  if (role === "STAFF") {
    const staff = staffMetrics.find((s) => s.staffId === userId) || {};

    payload = {
      myPerformance: staff,
      risks,
    };
  } else {
    payload = {
      time,
      staffMetrics,
      assets,
      risks,
      cashflow,
      funnel,
      health,
    };
  }

  return response.success(
    req,
    res,
    payload,
    200,
    "dashboard.enterprise_loaded",
  );
});

exports.getInsights = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const insights = await require("./dashboard.insight.service").getInsights(
    businessId,
  );

  return response.success(req, res, insights, 200, "dashboard.insights_loaded");
});

const exportService = require("./dashboard.export.service");

exports.exportCSV = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const csv = await exportService.exportCSV(businessId);

  res.header("Content-Type", "text/csv");
  res.attachment("dashboard.csv");

  return res.send(csv);
});

exports.exportPDF = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=dashboard.pdf");

  await exportService.exportPDF(businessId, res);
});

/**
 * ===============================
 * ANALYTICS (ADDED – ORIGINAL CODE ABOVE UNTOUCHED)
 * ===============================
 */

exports.getSnapshotSeries = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const data = await analyticsService.getSnapshotSeries(businessId);

  return response.success(req, res, data, 200, "dashboard.snapshots_loaded");
});

exports.getHealthTimeline = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const data = await analyticsService.getHealthTimeline(businessId);

  return response.success(
    req,
    res,
    data,
    200,
    "dashboard.health_timeline_loaded",
  );
});

exports.getAnalyticsInsights = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const insights = await analyticsService.generateInsights(businessId);

  return response.success(req, res, insights, 200, "dashboard.insights_loaded");
});

exports.getCohorts = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const data = await analyticsService.getCohorts(businessId);

  return response.success(req, res, data, 200, "dashboard.cohorts_loaded");
});

exports.getProjections = catchAsync(async (req, res) => {
  const { businessId, role } = req.user;

  if (!["BUSINESS_OWNER", "MANAGER"].includes(role)) {
    return response.success(req, res, {}, 200, "dashboard.projections_loaded");
  }

  const data = await analyticsService.getProjections(businessId);

  return response.success(req, res, data, 200, "dashboard.projections_loaded");
});

exports.getAuditDashboard = catchAsync(async (req, res) => {
  const { businessId, role } = req.user;

  if (role !== "BUSINESS_OWNER") {
    return response.success(req, res, [], 200, "dashboard.audit_loaded");
  }

  const data = await analyticsService.getAuditDashboard(businessId);

  return response.success(req, res, data, 200, "dashboard.audit_loaded");
});

exports.getRoleDashboard = catchAsync(async (req, res) => {
  const { businessId, role } = req.user;

  const base = {
    snapshots: await analyticsService.getSnapshotSeries(businessId),
    healthTimeline: await analyticsService.getHealthTimeline(businessId),
    insights: await analyticsService.generateInsights(businessId),
    cohorts: await analyticsService.getCohorts(businessId),
  };

  if (role === "BUSINESS_OWNER" || role === "MANAGER") {
    base.projections = await analyticsService.getProjections(businessId);
  }

  if (role === "BUSINESS_OWNER") {
    base.audit = await analyticsService.getAuditDashboard(businessId);
  }

  return response.success(req, res, base, 200, "dashboard.role_loaded");
});

/**
 * ===========================
 * ADVANCED PORTFOLIO METRICS
 * ===========================
 */
exports.getAdvancedPortfolioMetrics = catchAsync(async (req, res) => {
  const { businessId } = req.user;

  const data = await analyticsService.getAdvancedPortfolioMetrics(businessId);

  return response.success(
    req,
    res,
    data,
    200,
    "dashboard.advanced_metrics_loaded",
  );
});
