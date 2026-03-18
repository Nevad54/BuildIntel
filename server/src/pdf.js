import PDFDocument from "pdfkit";

const money = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

export const buildEstimatePdf = (estimate, project, company, res) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/\s+/g, "-").toLowerCase()}-estimate.pdf"`);

  doc.pipe(res);

  doc.fontSize(20).fillColor("#111111").text(company.name, { align: "left" });
  doc.fontSize(10).fillColor("#6b7280").text("BuildIntel Construction Estimate Proposal");
  doc.moveDown(0.8);

  doc.fontSize(15).fillColor("#111111").text("Project Estimate");
  doc.fontSize(10).text(`Project: ${project.name}`);
  doc.text(`Location: ${project.location}`);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`);
  doc.text(`Estimate Status: ${estimate.status || "Draft"}`);
  doc.text(`Prepared for company plan: ${company.plan}`);
  doc.moveDown();

  doc.fontSize(11).text("Itemized Estimate", { underline: true });
  doc.moveDown(0.6);

  estimate.items.forEach((item) => {
    doc
      .fontSize(10)
      .fillColor("#111111")
      .text(`${item.material} (${item.category})`, { continued: true })
      .fillColor("#6b7280")
      .text(`  ${item.quantity} ${item.unit} x ${money(item.unitPrice)} = ${money(item.total)}`);
  });

  doc.moveDown();
  doc.fillColor("#111111").fontSize(11).text("Pricing Summary", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).text(`Direct Cost: ${money(estimate.directCost)}`);
  doc.text(`Labor Cost: ${money(estimate.laborCost)}`);
  doc.text(`Equipment Cost: ${money(estimate.equipmentCost)}`);
  doc.text(`Waste Factor: ${estimate.wasteFactorPercent}%`);
  doc.text(`Overhead: ${estimate.overheadPercent}%`);
  doc.text(`Profit: ${estimate.profitPercent}%`);
  doc.text(`Contingency: ${estimate.contingencyPercent}%`);
  doc.fontSize(12).text(`Final Contract Price: ${money(estimate.finalContractPrice)}`);
  if (estimate.reviewedAt) {
    doc.fontSize(10).text(`Reviewed: ${new Date(estimate.reviewedAt).toLocaleString()}`);
  }
  if (estimate.approvedAt) {
    doc.fontSize(10).text(`Approved: ${new Date(estimate.approvedAt).toLocaleString()}`);
  }

  doc.moveDown(2);
  doc.fontSize(10).text("Prepared by: __________________________");
  doc.moveDown(1.5);
  doc.text("Approved by: __________________________");
  doc.end();
};
