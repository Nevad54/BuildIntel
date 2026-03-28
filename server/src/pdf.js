import PDFDocument from "pdfkit";

const money = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const round = (v) => Math.round(v * 100) / 100;

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

  // Civil estimates have no floor area — derive a meaningful area descriptor from prompt
  const isCivil = estimate.discipline === "civil" || (Number(estimate.areaSqm) === 0 && estimate.items?.some((i) => /(waterline|drainage|road|pipe|valve|hydrant)/i.test(i.material || "")));
  if (isCivil) {
    // Try to read road/pipe length from the prompt text if present
    const promptRoadMatch = (estimate.prompt || "").match(/total road[:\s]+(\d+(?:\.\d+)?)\s*m/i);
    const promptPipeMatch = (estimate.prompt || "").match(/(\d+(?:\.\d+)?)\s*m\b/g);
    const maxPipeLen = promptPipeMatch ? Math.max(...promptPipeMatch.map((m) => Number(m))) : 0;
    const roadLen = promptRoadMatch ? Number(promptRoadMatch[1]) : maxPipeLen;
    if (roadLen > 0) {
      doc.text(`Road / Pipe Network: ${roadLen.toLocaleString()} m`);
    }
  } else {
    const areaSqm = Number(estimate.areaSqm) || 0;
    if (areaSqm > 0) {
      doc.text(`Floor Area: ${areaSqm.toLocaleString()} sqm`);
    }
  }

  doc.text(`Generated: ${new Date().toLocaleDateString()}`);
  doc.text(`Estimate Status: ${estimate.status || "Draft"}`);
  doc.text(`Prepared for company plan: ${company.plan}`);
  doc.moveDown();

  doc.fontSize(11).text("Itemized Estimate", { underline: true });
  doc.moveDown(0.6);

  estimate.items.forEach((item) => {
    const payItemStr = item.payItem ? `[${item.payItem}] ` : "";
    const line = `  ${item.quantity} ${item.unit} x ${money(item.unitPrice)} = ${money(item.total)}${item.remarks ? `  [${item.remarks}]` : ""}`;
    doc
      .fontSize(10)
      .fillColor("#111111")
      .text(`${payItemStr}${item.material} (${item.category})`, { continued: true })
      .fillColor("#6b7280")
      .text(line);
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

export const buildEstimateSummaryPdf = (estimate, project, company, res) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/\s+/g, "-").toLowerCase()}-summary.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width - 100; // usable width between margins

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.fontSize(22).fillColor("#0f172a").text(company.name, { align: "left" });
  doc.fontSize(10).fillColor("#64748b").text("Construction Estimate Proposal", { align: "left" });
  doc.moveDown(0.5);
  // Horizontal rule
  doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // ── Project info block ───────────────────────────────────────────────────────
  doc.fontSize(16).fillColor("#0f172a").text("Project Estimate Summary");
  doc.moveDown(0.5);

  const infoRows = [
    ["Project", project.name],
    ["Location", project.location || estimate.location || "Philippines"],
    ["Status", estimate.status || "Draft"],
    ["Discipline", estimate.discipline ? estimate.discipline.charAt(0).toUpperCase() + estimate.discipline.slice(1) : "General Construction"],
    ["Date", new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })],
  ];
  if (Number(estimate.areaSqm) > 0) {
    infoRows.push(["Floor Area", `${Number(estimate.areaSqm).toLocaleString()} sqm`]);
  }

  infoRows.forEach(([label, value]) => {
    doc.fontSize(10)
      .fillColor("#64748b").text(`${label}:`, { continued: true, width: 120 })
      .fillColor("#0f172a").text(`  ${value}`);
  });

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // ── Cost summary table ───────────────────────────────────────────────────────
  doc.fontSize(13).fillColor("#0f172a").text("Cost Summary", { underline: false });
  doc.moveDown(0.5);

  const directCost = Number(estimate.directCost) || 0;
  const materialCost = (estimate.items || [])
    .filter((i) => i.category === "Materials")
    .reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const laborCost = Number(estimate.laborCost) || 0;
  const equipmentCost = Number(estimate.equipmentCost) || 0;
  const overhead = Math.round(directCost * (Number(estimate.overheadPercent) || 0) / 100);
  const profit = Math.round(directCost * (Number(estimate.profitPercent) || 0) / 100);
  const contingency = Math.round(directCost * (Number(estimate.contingencyPercent) || 0) / 100);
  const finalPrice = Number(estimate.finalContractPrice) || 0;

  const tableRows = [
    ["Materials", money(materialCost), directCost > 0 ? pct((materialCost / directCost) * 100) : "—"],
    ["Labor", money(laborCost), directCost > 0 ? pct((laborCost / directCost) * 100) : "—"],
    ["Equipment", money(equipmentCost), directCost > 0 ? pct((equipmentCost / directCost) * 100) : "—"],
    ["Direct Cost", money(directCost), "100.0%"],
    ["Overhead", money(overhead), pct(estimate.overheadPercent)],
    ["Profit", money(profit), pct(estimate.profitPercent)],
    ["Contingency", money(contingency), pct(estimate.contingencyPercent)],
  ];

  const col1W = pageW * 0.45;
  const col2W = pageW * 0.35;
  const col3W = pageW * 0.20;

  // Table header
  const tableStartX = 50;
  let tableY = doc.y;
  doc.rect(tableStartX, tableY, pageW, 18).fill("#f1f5f9");
  doc.fontSize(9).fillColor("#475569")
    .text("Description", tableStartX + 6, tableY + 5, { width: col1W })
    .text("Amount", tableStartX + col1W + 6, tableY + 5, { width: col2W, align: "right" })
    .text("Share", tableStartX + col1W + col2W + 6, tableY + 5, { width: col3W, align: "right" });
  tableY += 20;

  tableRows.forEach(([label, amount, share], i) => {
    const isDirectCost = label === "Direct Cost";
    const bg = isDirectCost ? "#e0f2fe" : i % 2 === 0 ? "#ffffff" : "#f8fafc";
    doc.rect(tableStartX, tableY, pageW, 16).fill(bg);
    doc.fontSize(9)
      .fillColor(isDirectCost ? "#0369a1" : "#0f172a")
      .font(isDirectCost ? "Helvetica-Bold" : "Helvetica")
      .text(label, tableStartX + 6, tableY + 4, { width: col1W })
      .text(amount, tableStartX + col1W + 6, tableY + 4, { width: col2W, align: "right" })
      .text(share, tableStartX + col1W + col2W + 6, tableY + 4, { width: col3W, align: "right" });
    tableY += 16;
  });

  // Final contract price row
  doc.rect(tableStartX, tableY, pageW, 20).fill("#0f172a");
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff")
    .text("FINAL CONTRACT PRICE", tableStartX + 6, tableY + 5, { width: col1W + col2W })
    .text(money(finalPrice), tableStartX + col1W + 6, tableY + 5, { width: col2W, align: "right" });
  doc.font("Helvetica");
  tableY += 22;

  doc.y = tableY;
  doc.moveDown(1);

  // ── BOQ item count by category ───────────────────────────────────────────────
  const categories = ["Materials", "Labor", "Equipment"];
  const catCounts = categories.map((cat) => ({
    cat,
    count: (estimate.items || []).filter((i) => i.category === cat).length
  }));

  doc.fontSize(11).fillColor("#0f172a").text("Scope Coverage");
  doc.moveDown(0.4);
  catCounts.forEach(({ cat, count }) => {
    doc.fontSize(9).fillColor("#475569").text(`${cat}: `, { continued: true }).fillColor("#0f172a").text(`${count} BOQ line items`);
  });

  doc.moveDown(1);

  // ── Prompt / description ─────────────────────────────────────────────────────
  if (estimate.prompt) {
    doc.fontSize(11).fillColor("#0f172a").text("Project Description");
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#475569")
      .text(estimate.prompt.replace(/^\[Document:[^\]]+\]\s*/i, "").slice(0, 500), {
        width: pageW,
        lineGap: 2
      });
    doc.moveDown(1);
  }

  // ── Signature block ──────────────────────────────────────────────────────────
  doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#64748b").text("This document is a cost estimate and is subject to revision based on actual site conditions, material price changes, and final scope of work.");
  doc.moveDown(1.5);

  const sigColW = pageW / 2 - 20;
  const sigY = doc.y;
  doc.fontSize(9).fillColor("#0f172a")
    .text("Prepared by:", 50, sigY)
    .text("Approved by:", 50 + sigColW + 20, sigY);
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(50 + sigColW, doc.y).strokeColor("#94a3b8").lineWidth(0.5).stroke();
  doc.moveTo(50 + sigColW + 20, doc.y).lineTo(50 + pageW, doc.y).strokeColor("#94a3b8").lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor("#94a3b8")
    .text("Signature over printed name / date", 50)
    .text("Signature over printed name / date", 50 + sigColW + 20, doc.y - 10);

  doc.end();
};

export const buildDpwhBoqPdf = (estimate, project, company, res) => {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/\s+/g, "-").toLowerCase()}-dpwh-boq.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width - 80; // usable width in landscape

  // ── Title block ─────────────────────────────────────────────────────────────
  doc.fontSize(13).fillColor("#0f172a").font("Helvetica-Bold")
    .text("BILL OF QUANTITIES", { align: "center" });
  doc.fontSize(10).font("Helvetica").fillColor("#374151")
    .text(company.name, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#6b7280")
    .text(`Project: ${project.name}   |   Location: ${project.location || estimate.location || "Philippines"}   |   Date: ${new Date().toLocaleDateString("en-PH")}`, { align: "center" });
  doc.moveDown(0.6);

  // horizontal rule
  doc.moveTo(40, doc.y).lineTo(40 + pageW, doc.y).strokeColor("#cbd5e1").lineWidth(0.8).stroke();
  doc.moveDown(0.5);

  // ── Column layout ────────────────────────────────────────────────────────────
  // Pay Item | Description | Quantity | Unit | Unit Cost | Amount
  const colX = [40, 40 + pageW * 0.10, 40 + pageW * 0.52, 40 + pageW * 0.63, 40 + pageW * 0.70, 40 + pageW * 0.82];
  const colW = [pageW * 0.10, pageW * 0.42, pageW * 0.11, pageW * 0.07, pageW * 0.12, pageW * 0.16];
  const headers = ["Pay Item", "Description / Scope of Work", "Quantity", "Unit", "Unit Cost (PHP)", "Amount (PHP)"];

  const drawHeaders = () => {
    const hY = doc.y;
    doc.rect(40, hY, pageW, 16).fill("#1e293b");
    headers.forEach((h, i) => {
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#f8fafc")
        .text(h, colX[i] + 3, hY + 4, { width: colW[i] - 6, align: i >= 2 ? "right" : "left" });
    });
    doc.y = hY + 18;
    doc.font("Helvetica");
  };

  drawHeaders();

  let rowY = doc.y;
  let rowIndex = 0;
  const categories = ["Materials", "Labor", "Equipment"];

  categories.forEach((cat) => {
    const catItems = (estimate.items || []).filter((i) => i.category === cat);
    if (!catItems.length) return;

    // Category header row
    doc.rect(40, rowY, pageW, 14).fill("#f1f5f9");
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a")
      .text(cat.toUpperCase(), colX[1] + 3, rowY + 3, { width: colW[1] });
    doc.font("Helvetica");
    rowY += 15;

    catItems.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const amount = round(qty * unitPrice);
      const bg = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";

      // Check if we need a new page
      if (rowY > doc.page.height - 80) {
        doc.addPage({ layout: "landscape", margin: 40 });
        rowY = 40;
        drawHeaders();
      }

      doc.rect(40, rowY, pageW, 14).fill(bg);
      doc.fontSize(7.5).fillColor("#0f172a");

      // Pay Item
      doc.text(item.payItem || "—", colX[0] + 3, rowY + 3, { width: colW[0] - 6 });
      // Description
      doc.text(item.material || "", colX[1] + 3, rowY + 3, { width: colW[1] - 6 });
      // Quantity
      doc.text(qty.toLocaleString(), colX[2] + 3, rowY + 3, { width: colW[2] - 6, align: "right" });
      // Unit
      doc.text(item.unit || "", colX[3] + 3, rowY + 3, { width: colW[3] - 6, align: "right" });
      // Unit Cost
      doc.text(unitPrice.toLocaleString(), colX[4] + 3, rowY + 3, { width: colW[4] - 6, align: "right" });
      // Amount
      doc.text(amount.toLocaleString(), colX[5] + 3, rowY + 3, { width: colW[5] - 6, align: "right" });

      rowY += 14;
      rowIndex++;
    });

    // Subtotal row for this category
    const catTotal = catItems.reduce((s, i) => s + round((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
    doc.rect(40, rowY, pageW, 14).fill("#e2e8f0");
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a")
      .text(`${cat} Subtotal`, colX[1] + 3, rowY + 3, { width: colW[1] + colW[2] + colW[3] + colW[4] })
      .text(`PHP ${catTotal.toLocaleString()}`, colX[5] + 3, rowY + 3, { width: colW[5] - 6, align: "right" });
    doc.font("Helvetica");
    rowY += 16;
  });

  // ── Summary section ──────────────────────────────────────────────────────────
  if (rowY > doc.page.height - 120) {
    doc.addPage({ layout: "landscape", margin: 40 });
    rowY = 40;
  }

  rowY += 6;
  doc.moveTo(40, rowY).lineTo(40 + pageW, rowY).strokeColor("#94a3b8").lineWidth(0.5).stroke();
  rowY += 8;

  const summaryRows = [
    ["Direct Cost", estimate.directCost || 0],
    [`Overhead (${estimate.overheadPercent || 0}%)`, Math.round((estimate.directCost || 0) * (estimate.overheadPercent || 0) / 100)],
    [`Profit (${estimate.profitPercent || 0}%)`, Math.round((estimate.directCost || 0) * (estimate.profitPercent || 0) / 100)],
    [`Contingency (${estimate.contingencyPercent || 0}%)`, Math.round((estimate.directCost || 0) * (estimate.contingencyPercent || 0) / 100)],
  ];

  summaryRows.forEach(([label, value]) => {
    doc.rect(40, rowY, pageW, 13).fill("#f8fafc");
    doc.fontSize(8).font("Helvetica").fillColor("#374151")
      .text(label, colX[1] + 3, rowY + 3, { width: colW[1] + colW[2] + colW[3] + colW[4] })
      .text(`PHP ${Number(value).toLocaleString()}`, colX[5] + 3, rowY + 3, { width: colW[5] - 6, align: "right" });
    rowY += 13;
  });

  // Final contract price
  doc.rect(40, rowY, pageW, 18).fill("#0f172a");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff")
    .text("TOTAL CONTRACT AMOUNT", colX[1] + 3, rowY + 5, { width: colW[1] + colW[2] + colW[3] + colW[4] })
    .text(`PHP ${Number(estimate.finalContractPrice || 0).toLocaleString()}`, colX[5] + 3, rowY + 5, { width: colW[5] - 6, align: "right" });
  rowY += 22;

  // ── Certification block ──────────────────────────────────────────────────────
  doc.y = rowY + 10;
  doc.fontSize(7.5).font("Helvetica").fillColor("#6b7280")
    .text("I hereby certify that the above Bill of Quantities is correct and in accordance with the plans and specifications.", 40, doc.y, { width: pageW });
  doc.moveDown(1.8);

  const sigW = pageW / 3 - 15;
  const sigStartY = doc.y;
  ["Prepared by:", "Checked by:", "Approved by:"].forEach((label, i) => {
    const x = 40 + i * (sigW + 15);
    doc.fontSize(7.5).fillColor("#374151").text(label, x, sigStartY);
    doc.moveTo(x, sigStartY + 22).lineTo(x + sigW, sigStartY + 22).strokeColor("#94a3b8").lineWidth(0.4).stroke();
    doc.fontSize(7).fillColor("#9ca3af").text("Signature / Name / Date", x, sigStartY + 24);
  });

  doc.end();
};
