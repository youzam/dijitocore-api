const prisma = require("../../config/prisma");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");

/**
 * =============================
 * CSV EXPORT
 * =============================
 */
exports.exportCSV = async (businessId) => {
  const snapshots = await prisma.dashboardSnapshot.findMany({
    where: { businessId },
    orderBy: { snapshotDate: "asc" },
  });

  const parser = new Parser();
  return parser.parse(snapshots);
};

/**
 * =============================
 * PDF EXPORT
 * =============================
 */
exports.exportPDF = async (businessId, res) => {
  const latest = await prisma.dashboardSnapshot.findFirst({
    where: { businessId },
    orderBy: { snapshotDate: "desc" },
  });

  const doc = new PDFDocument();

  doc
    .fontSize(18)
    .text("DijitoTrack Enterprise Dashboard", { align: "center" });
  doc.moveDown();

  if (latest) {
    doc.fontSize(12).text(`Portfolio: ${latest.portfolio}`);
    doc.text(`Collected: ${latest.collected}`);
    doc.text(`Outstanding: ${latest.outstanding}`);
    doc.text(`Overdue: ${latest.overdue}`);
    doc.text(`Cashflow 30 days: ${latest.cashflow30}`);
    doc.text(`Cashflow 60 days: ${latest.cashflow60}`);
    doc.text(`Cashflow 90 days: ${latest.cashflow90}`);
  } else {
    doc.text("No snapshot data available");
  }

  doc.pipe(res);
  doc.end();
};
