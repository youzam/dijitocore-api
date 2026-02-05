const catchAsync = require("../../utils/catchAsync");
const response = require("../../utils/response");

const dashboardService = require("./dashboard.service");

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
