const PDFDocument = require("pdfkit");

module.exports = function generateStatement({ contract, payments }) {
  const doc = new PDFDocument({ margin: 50 });

  doc.fontSize(16).text("Contract Statement", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Contract No: ${contract.contractNumber}`);
  doc.text(`Customer: ${contract.customerName}`);
  doc.text(`Total Value: ${contract.totalValue}`);
  doc.text(`Paid Amount: ${contract.totalPaid}`);
  doc.text(`Outstanding: ${contract.outstandingAmount}`);
  doc.moveDown();

  doc.text("Payments:");
  doc.moveDown(0.5);

  payments.forEach((p, i) => {
    doc.text(
      `${i + 1}. ${new Date(p.createdAt).toLocaleDateString()} - ${p.amount}`,
    );
  });

  doc.end();
  return doc;
};
