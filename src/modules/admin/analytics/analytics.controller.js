const analyticsService = require("./analytics.service");
const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

// =============================
// DASHBOARD
// =============================
exports.getDashboard = catchAsync(async (req, res) => {
  const data = await analyticsService.getDashboardSummary(req.query);

  return response.success(req, res, data, 200, "analytics.dashboardSuccess");
});

// =============================
// REVENUE
// =============================
exports.getRevenueTrends = catchAsync(async (req, res) => {
  const data = await analyticsService.getRevenueTrends(req.query);

  return response.success(req, res, data, 200, "analytics.revenueSuccess");
});

exports.getRevenueByCountry = catchAsync(async (req, res) => {
  const data = await analyticsService.getRevenueByCountry(req.query);

  return response.success(req, res, data, 200, "analytics.revenueSuccess");
});

exports.getRevenueByPackage = catchAsync(async (req, res) => {
  const data = await analyticsService.getRevenueByPackage(req.query);

  return response.success(req, res, data, 200, "analytics.revenueSuccess");
});

// =============================
// SUBSCRIPTIONS
// =============================
exports.getSubscriptionMetrics = catchAsync(async (req, res) => {
  const data = await analyticsService.getSubscriptionMetrics();

  return response.success(req, res, data, 200, "analytics.subscriptionSuccess");
});

// =============================
// GROWTH
// =============================
exports.getBusinessGrowth = catchAsync(async (req, res) => {
  const data = await analyticsService.getBusinessGrowth(req.query);

  return response.success(req, res, data, 200, "analytics.growthSuccess");
});

exports.getUserGrowth = catchAsync(async (req, res) => {
  const data = await analyticsService.getUserGrowth(req.query);

  return response.success(req, res, data, 200, "analytics.growthSuccess");
});

// =============================
// COHORT
// =============================
exports.getCohortAnalysis = catchAsync(async (req, res) => {
  const data = await analyticsService.getCohortAnalysis();

  return response.success(req, res, data, 200, "analytics.cohortSuccess");
});

// =============================
// TENANT HEALTH
// =============================
exports.getTenantHealth = catchAsync(async (req, res) => {
  const data = await analyticsService.getTenantHealth();

  return response.success(req, res, data, 200, "analytics.healthSuccess");
});

// =============================
// ADVANCED ANALYTICS
// =============================

exports.getCohortRetention = catchAsync(async (req, res) => {
  const data = await analyticsService.getCohortRetention();

  return response.success(
    req,
    res,
    data,
    200,
    "analytics.cohortRetentionSuccess",
  );
});

exports.getUsageAnalytics = catchAsync(async (req, res) => {
  const data = await analyticsService.getUsageAnalytics();

  return response.success(req, res, data, 200, "analytics.usageSuccess");
});

exports.getExpansionRevenue = catchAsync(async (req, res) => {
  const data = await analyticsService.getExpansionRevenue();

  return response.success(req, res, data, 200, "analytics.expansionSuccess");
});

exports.getRenewalRate = catchAsync(async (req, res) => {
  const data = await analyticsService.getRenewalRate();

  return response.success(req, res, data, 200, "analytics.renewalSuccess");
});

exports.getConversionRate = catchAsync(async (req, res) => {
  const data = await analyticsService.getConversionRate();

  return response.success(req, res, data, 200, "analytics.conversionSuccess");
});

exports.getChurnRate = catchAsync(async (req, res) => {
  const data = await analyticsService.getChurnRate(req.query);

  return response.success(req, res, data, 200, "analytics.churnSuccess");
});

exports.getTenantHealthAdvanced = catchAsync(async (req, res) => {
  const data = await analyticsService.getTenantHealthAdvanced();

  return response.success(
    req,
    res,
    data,
    200,
    "analytics.healthAdvancedSuccess",
  );
});
