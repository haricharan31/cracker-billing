const express = require('express');
const pool = require('../config/database');
const { generateBillPDF } = require('../helpers/pdfGenerator');

const router = express.Router();

async function getBillByToken(token) {
  const result = await pool.query(
    `SELECT b.*, c.shop_name, c.customer_name, c.phone, c.location
     FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
     WHERE b.approval_token = $1`,
    [token]
  );
  return result.rows[0];
}

async function getOperatorPhone() {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'operator_phone'");
  return result.rows[0]?.value || null;
}

// GET /api/approval/:token
router.get('/:token', async (req, res) => {
  try {
    const bill = await getBillByToken(req.params.token);
    if (!bill) return res.status(404).json({ error: 'Invalid approval link' });
    if (new Date() > new Date(bill.token_expires_at)) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }
    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [bill.id]
    );
    const items = itemsResult.rows.map(item => ({
      ...item,
      rate_after_disc: parseFloat(
        (Number(item.rate_per_box) * (1 + Number(item.discount_percent) / 100)).toFixed(2)
      ),
    }));
    const operator_phone = await getOperatorPhone();
    res.json({ ...bill, items, operator_phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/approval/:token/approve
router.put('/:token/approve', async (req, res) => {
  try {
    const bill = await getBillByToken(req.params.token);
    if (!bill) return res.status(404).json({ error: 'Invalid approval link' });
    if (new Date() > new Date(bill.token_expires_at)) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }
    if (bill.status !== 'pending') {
      return res.status(400).json({ error: `Bill is already ${bill.status}` });
    }
    await pool.query(
      "UPDATE bills SET status = 'approved' WHERE id = $1",
      [bill.id]
    );

    // Fetch full bill with items for PDF generation
    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [bill.id]
    );
    const fullBill = { ...bill, items: itemsResult.rows };

    // Generate PDF
    let pdf_url = null;
    let pdfError = null;
    try {
      const tunnelUrl = 'https://cracker-billing.onrender.com';

      await generateBillPDF(fullBill);

      if (tunnelUrl) {
        pdf_url = `${tunnelUrl}/pdfs/${bill.bill_number}.pdf`;
      }

      const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'owner_phone'");
      const owner_phone = settingsResult.rows[0]?.value || null;
      const whatsapp_message = pdf_url
        ? `Bill Approved! ✅\nBill No: ${bill.bill_number}\nCustomer: ${bill.shop_name}\nGrand Total: Rs.${Number(bill.grand_total).toFixed(2)}\nDownload Invoice PDF: ${pdf_url}`
        : `Bill Approved! ✅\nBill No: ${bill.bill_number}\nCustomer: ${bill.shop_name}\nGrand Total: Rs.${Number(bill.grand_total).toFixed(2)}`;

      return res.json({
        message: 'Bill approved successfully',
        bill_number: bill.bill_number,
        pdf_url,
        whatsapp_message,
        owner_phone,
      });
    } catch (pdfErr) {
      pdfError = pdfErr.message;
    }

    res.json({
      message: 'Bill approved successfully',
      bill_number: bill.bill_number,
      pdf_url: null,
      pdf_error: pdfError,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/approval/:token/reject
router.put('/:token/reject', async (req, res) => {
  try {
    const { rejection_comment } = req.body;
    const bill = await getBillByToken(req.params.token);
    if (!bill) return res.status(404).json({ error: 'Invalid approval link' });
    if (new Date() > new Date(bill.token_expires_at)) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }
    if (bill.status !== 'pending') {
      return res.status(400).json({ error: `Bill is already ${bill.status}` });
    }
    await pool.query(
      "UPDATE bills SET status = 'rejected', rejection_comment = $1 WHERE id = $2",
      [rejection_comment || null, bill.id]
    );
    res.json({ message: 'Bill rejected', bill_number: bill.bill_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
