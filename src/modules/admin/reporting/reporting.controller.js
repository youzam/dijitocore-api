const reportingService = require("./reporting.service");
const catchAsync = require("../../../utils/catchAsync");
const response = require("../../../utils/response");

// =============================
// EXPORT HANDLER
// =============================
const handleExportResponse = (res, result, filenamePrefix) => {
  const { format, file } = result;

  let contentType = "application/octet-stream";
  let extension = "dat";

  if (format === "csv") {
    contentType = "text/csv";
    extension = "csv";
  }

  if (format === "excel") {
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    extension = "xlsx";
  }

  if (format === "pdf") {
    contentType = "application/pdf";
    extension = "pdf";
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${filenamePrefix}.${extension}`,
  );

  return res.send(file);
};

// =============================
// 1. TRANSACTIONS
// =============================
exports.getTransactionReport = catchAsync(async (req, res) => {
  const data = await reportingService.getTransactionReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "transactions_report");
  }

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.transactionsFetchSuccess",
  );
});

// =============================
// 2. MONTHLY REVENUE
// =============================
exports.getMonthlyRevenueReport = catchAsync(async (req, res) => {
  const data = await reportingService.getMonthlyRevenueReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "monthly_revenue_report");
  }

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.monthlyRevenueSuccess",
  );
});

// =============================
// 3. SETUP FEES
// =============================
exports.getSetupFeeReport = catchAsync(async (req, res) => {
  const data = await reportingService.getSetupFeeReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "setup_fee_report");
  }

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.setupFeeFetchSuccess",
  );
});

// =============================
// 4. SUBSCRIPTION REVENUE
// =============================
exports.getSubscriptionRevenueReport = catchAsync(async (req, res) => {
  const data = await reportingService.getSubscriptionRevenueReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "subscription_revenue_report");
  }

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.subscriptionRevenueSuccess",
  );
});

// =============================
// 5. REFUNDS
// =============================
exports.getRefundReport = catchAsync(async (req, res) => {
  const data = await reportingService.getRefundReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "refund_report");
  }

  return response.success(req, res, data, 200, "reporting.refundFetchSuccess");
});

// =============================
// 6. COUPONS
// =============================
exports.getCouponReport = catchAsync(async (req, res) => {
  const data = await reportingService.getCouponReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "coupon_report");
  }

  return response.success(req, res, data, 200, "reporting.couponFetchSuccess");
});

// =============================
// 7. SUPPORT
// =============================
exports.getSupportReport = catchAsync(async (req, res) => {
  const data = await reportingService.getSupportReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "support_report");
  }

  return response.success(req, res, data, 200, "reporting.supportFetchSuccess");
});

// =============================
// 8. AUDIT
// =============================
exports.getAuditReport = catchAsync(async (req, res) => {
  const data = await reportingService.getAuditReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "audit_report");
  }

  return response.success(req, res, data, 200, "reporting.auditFetchSuccess");
});

// =============================
// 9. COMPLIANCE
// =============================
exports.getComplianceReport = catchAsync(async (req, res) => {
  const data = await reportingService.getComplianceReport(req.query);

  if (data.export) {
    return handleExportResponse(res, data, "compliance_report");
  }

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.complianceFetchSuccess",
  );
});

// =============================
// ASYNC EXPORT
// =============================
exports.createAsyncExport = catchAsync(async (req, res) => {
  const adminId = req.user.id;

  const { type } = req.params;

  const data = await reportingService.createAsyncExport(
    req.query,
    adminId,
    type,
  );

  return response.success(req, res, data, 201, "reporting.exportCreated");
});

// =============================
// EXPORT HISTORY
// =============================
exports.getExportHistory = catchAsync(async (req, res) => {
  const data = await reportingService.getExportHistory(req.user.id);

  return response.success(
    req,
    res,
    data,
    200,
    "reporting.exportHistoryFetched",
  );
});

// =============================
// DOWNLOAD FILE
// =============================
exports.downloadExport = catchAsync(async (req, res) => {
  const record = await reportingService.downloadExportFile(req.params.id);

  return res.download(record.filePath);
});

exports.getSupportSummary = catchAsync(async (req, res) => {
  const data = await reportingService.getSupportSummaryReport(req.query);

  return response.success(req, res, data);
});

exports.getSupportSLA = catchAsync(async (req, res) => {
  const data = await reportingService.getSupportSLAReport();

  return response.success(req, res, data);
});

exports.getTicketsPerBusiness = catchAsync(async (req, res) => {
  const data = await reportingService.getTicketsPerBusinessReport();

  return response.success(req, res, data);
});
