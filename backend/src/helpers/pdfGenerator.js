const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, '../../public/pdfs');

function rs(n) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function num(v) { return Number(v || 0); }

// Draws a horizontal line across the page
function hline(doc, y) {
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor('#bbbbbb').lineWidth(0.5).stroke();
}

// Draw a bordered table section
function drawItemSection(doc, title, items, showCompany, subtotal, startX, pageWidth) {
  if (!items || items.length === 0) return;

  const colW = showCompany
    ? { no: 20, item: 138, company: 80, cases: 35, boxes: 35, rate: 44, disc: 30, rateAD: 44, total: pageWidth - 20 - 138 - 80 - 35 - 35 - 44 - 30 - 44 }
    : { no: 20, item: 180, cases: 35, boxes: 35, rate: 44, disc: 30, rateAD: 44, total: pageWidth - 20 - 180 - 35 - 35 - 44 - 30 - 44 };

  const cellPad = 3;
  const rowH = 14;
  const headH = 16;

  // Section title
  doc.fontSize(8).font('Helvetica-Bold').text(title, startX, doc.y + 6);
  doc.moveDown(0.2);

  const tableTop = doc.y;
  let x = startX;

  // Header row background
  doc.rect(x, tableTop, pageWidth, headH).fill('#f0f0f0');
  doc.strokeColor('#000000').lineWidth(0.5).rect(x, tableTop, pageWidth, headH).stroke();

  // Header text
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7.5);
  const headers = showCompany
    ? ['#', 'Item Name', 'Company', 'Cases', 'Boxes', 'Rate/Box', 'Disc%', 'Rate/Disc', 'Total']
    : ['#', 'Item Name', 'Cases', 'Boxes', 'Rate/Box', 'Disc%', 'Rate/Disc', 'Total'];

  const colWidths = showCompany
    ? [colW.no, colW.item, colW.company, colW.cases, colW.boxes, colW.rate, colW.disc, colW.rateAD, colW.total]
    : [colW.no, colW.item, colW.cases, colW.boxes, colW.rate, colW.disc, colW.rateAD, colW.total];

  const aligns = showCompany
    ? ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right']
    : ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'];

  let cx = startX;
  headers.forEach((h, i) => {
    doc.text(h, cx + cellPad, tableTop + cellPad, { width: colWidths[i] - cellPad * 2, align: aligns[i], lineBreak: false });
    cx += colWidths[i];
  });

  // Draw vertical separators in header
  cx = startX;
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i];
    doc.moveTo(cx, tableTop).lineTo(cx, tableTop + headH).strokeColor('#000000').lineWidth(0.3).stroke();
  }

  let rowY = tableTop + headH;

  items.forEach((item, idx) => {
    const cases = num(item.cases);
    const boxes = num(item.boxes);
    const rate = num(item.rate_per_box);
    const disc = num(item.discount_percent);
    const rateAD = rate * (1 + disc / 100);
    const total = rateAD * boxes;

    const casesDisplay = cases >= 1 ? String(Math.round(cases)) : '';
    const itemLabel = item.item_name || '';
    const companyLabel = item.company_name || '';

    // Row border
    const isLast = idx === items.length - 1;
    doc.strokeColor('#000000').lineWidth(isLast ? 0.5 : 0.3)
      .rect(startX, rowY, pageWidth, rowH).stroke();

    doc.fillColor('#000000').font('Helvetica').fontSize(7.5);
    const rowCols = showCompany
      ? [
          String(item.serial_number ?? idx + 1),
          itemLabel,
          companyLabel,
          casesDisplay,
          boxes > 0 ? String(boxes) : '',
          rate > 0 ? rate.toFixed(2) : '',
          disc.toFixed(0) + '%',
          rateAD > 0 ? rateAD.toFixed(2) : '',
          rs(total),
        ]
      : [
          String(item.serial_number ?? idx + 1),
          itemLabel,
          casesDisplay,
          boxes > 0 ? String(boxes) : '',
          rate > 0 ? rate.toFixed(2) : '',
          disc.toFixed(0) + '%',
          rateAD > 0 ? rateAD.toFixed(2) : '',
          rs(total),
        ];

    cx = startX;
    rowCols.forEach((val, i) => {
      doc.text(val, cx + cellPad, rowY + cellPad, {
        width: colWidths[i] - cellPad * 2,
        align: aligns[i],
        lineBreak: false,
      });
      if (i < colWidths.length - 1) {
        doc.moveTo(cx + colWidths[i], rowY).lineTo(cx + colWidths[i], rowY + rowH)
          .strokeColor('#000000').lineWidth(0.3).stroke();
      }
      cx += colWidths[i];
    });

    rowY += rowH;
  });

  // Subtotal row
  doc.moveDown(0.4);
  doc.y = rowY + 4;
  doc.font('Helvetica-Bold').fontSize(8)
    .text(`${title} Subtotal: ${rs(subtotal)}`, startX, doc.y, { align: 'right' });
  doc.moveDown(0.3);
}

/**
 * Generate a PDF for the given bill and save it to public/pdfs/<bill_number>.pdf
 * Returns the full file path.
 */
async function generateBillPDF(bill) {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }

  const filePath = path.join(PDF_DIR, `${bill.bill_number}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const startX = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Header ──────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(8).text('AMMA BHAGAWAN SHARANAM', startX, doc.page.margins.top, { align: 'center', width: pageWidth });
    doc.fontSize(12).text('LAXMI NARASIMHA TRADERS   JANGAON', { align: 'center', width: pageWidth });
    doc.moveDown(0.4);
    hline(doc, doc.y);
    doc.moveDown(0.4);

    // ── Bill meta ──────────────────────────────────────────
    const metaY = doc.y;
    doc.font('Helvetica').fontSize(8);
    doc.text(`Bill No: `, startX, metaY, { continued: true }).font('Helvetica-Bold').text(bill.bill_number || '');
    doc.font('Helvetica').text(`Date: `, startX + pageWidth - 100, metaY, { continued: true }).font('Helvetica-Bold').text(fmtDate(bill.bill_date));
    doc.font('Helvetica').text(`Customer Shop: `, startX, doc.y + 4, { continued: true }).font('Helvetica-Bold').text(bill.shop_name || '');
    doc.font('Helvetica').text(`Name: `, startX, doc.y + 4, { continued: true }).font('Helvetica-Bold').text(bill.customer_name || '');
    if (bill.phone) {
      doc.font('Helvetica').text(`   Phone: `, { continued: true }).font('Helvetica-Bold').text(bill.phone);
    } else {
      doc.moveDown(0.1);
    }
    if (bill.location) {
      doc.font('Helvetica').text(`Location: `, startX, doc.y + 4, { continued: true }).font('Helvetica-Bold').text(bill.location);
    }
    doc.moveDown(0.4);
    hline(doc, doc.y);

    // ── Item sections ────────────────────────────────────────
    const items = Array.isArray(bill.items) ? bill.items : [];
    const standard = items.filter(i => i.category === 'standard');
    const vadivel = items.filter(i => i.category === 'vadivel');
    const sparklers = items.filter(i => i.category === 'sparklers');
    const guns = items.filter(i => i.category === 'guns');
    const others = items.filter(i => i.category === 'others');

    drawItemSection(doc, 'STANDARD FIREWORKS', standard, false, bill.standard_subtotal, startX, pageWidth);
    drawItemSection(doc, 'VADIVEL FIREWORKS', vadivel, false, bill.vadivel_subtotal, startX, pageWidth);
    drawItemSection(doc, 'SPARKLERS', sparklers, false, bill.sparklers_subtotal, startX, pageWidth);
    drawItemSection(doc, 'GUNS', guns, false, bill.guns_subtotal, startX, pageWidth);
    drawItemSection(doc, 'OTHERS', others, true, bill.others_subtotal, startX, pageWidth);

    // ── Summary ───────────────────────────────────────────────
    doc.moveDown(0.4);
    hline(doc, doc.y);
    doc.moveDown(0.4);

    const sumY = doc.y;
    doc.font('Helvetica').fontSize(9).text(`Hamali: ${rs(bill.hamali_amount)}`, startX, sumY, { align: 'right', width: pageWidth });

    if (num(bill.amount_paid_before) > 0) {
      doc.moveDown(0.3);
      doc.text(`Amount Paid Before Billing: - ${rs(bill.amount_paid_before)}`, { align: 'right', width: pageWidth });
    }

    doc.moveDown(0.5);
    hline(doc, doc.y);
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(10).text(`Grand Total: ${rs(bill.grand_total)}`, startX, doc.y, { align: 'right', width: pageWidth });
    doc.moveDown(0.3);
    doc.fontSize(11).text(`Balance Due: ${rs(bill.balance_due)}`, { align: 'right', width: pageWidth });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = { generateBillPDF, PDF_DIR };
