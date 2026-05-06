const express = require('express');
const { randomUUID } = require('crypto');
const pool = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');
const { generateBillPDF } = require('../helpers/pdfGenerator');

const router = express.Router();

async function getSettings(client) {
  const result = await client.query('SELECT key, value FROM settings');
  return Object.fromEntries(result.rows.map(r => [r.key, r.value]));
}

async function generateBillNumber(client, prefix) {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT bill_number FROM bills WHERE bill_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${year}-%`]
  );
  let seq = 1;
  if (result.rows.length > 0) {
    const last = result.rows[0].bill_number;
    const parts = last.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

// GET /api/bills
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT b.*, c.shop_name, c.customer_name, c.phone
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE b.status = $1`;
    }
    query += ' ORDER BY b.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const billResult = await pool.query(
      `SELECT b.*, c.shop_name, c.customer_name, c.phone, c.location
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!billResult.rows[0]) return res.status(404).json({ error: 'Bill not found' });

    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [req.params.id]
    );
    const items = itemsResult.rows.map(item => ({
      ...item,
      rate_after_disc: parseFloat(
        (Number(item.rate_per_box) * (1 + Number(item.discount_percent) / 100)).toFixed(2)
      ),
    }));
    res.json({ ...billResult.rows[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/:id/pdf — generate PDF for any bill and return its public URL
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const billResult = await pool.query(
      `SELECT b.*, c.shop_name, c.customer_name, c.phone, c.location
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!billResult.rows[0]) return res.status(404).json({ error: 'Bill not found' });

    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [req.params.id]
    );
    const bill = { ...billResult.rows[0], items: itemsResult.rows };

    await generateBillPDF(bill);

    const tunnelUrl = 'https://cracker-billing.onrender.com';
    const pdf_url = `${tunnelUrl}/pdfs/${bill.bill_number}.pdf`;

    res.json({ pdf_url, bill_number: bill.bill_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bills — create new bill
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      customer_id,
      bill_date,
      items = [],
      amount_paid_before = 0,
      amount_paid_date = null,
      hamali_override = null,
      rp_count = null,
    } = req.body;

    if (!customer_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'customer_id required' });
    }
    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one item required' });
    }

    const settings = await getSettings(client);
    const prefix = settings.bill_prefix || 'LNT';
    const hamaliRate = parseFloat(settings.hamali_rate || 11);

    // Calculate subtotals per category
    let standard_subtotal = 0;
    let vadivel_subtotal = 0;
    let others_subtotal = 0;
    let sparklers_subtotal = 0;
    let guns_subtotal = 0;
    let total_cases = 0;

    const processedItems = items.map((item, idx) => {
      const boxes = parseInt(item.boxes || 0, 10);
      const rate = parseFloat(item.rate_per_box || 0);
      const discount = parseFloat(item.discount_percent || 0);
      const cases = parseInt(item.cases || 0, 10);
      const total_amount = parseFloat((boxes * rate * (1 + discount / 100)).toFixed(2));

      if (item.category === 'standard') standard_subtotal += total_amount;
      else if (item.category === 'vadivel') vadivel_subtotal += total_amount;
      else if (item.category === 'sparklers') sparklers_subtotal += total_amount;
      else if (item.category === 'guns') guns_subtotal += total_amount;
      else others_subtotal += total_amount;

      total_cases += cases;

      return {
        category: item.category,
        product_id: item.product_id || null,
        item_name: item.item_name,
        company_name: item.company_name || null,
        serial_number: item.serial_number || idx + 1,
        cases,
        boxes,
        rate_per_box: rate,
        discount_percent: discount,
        total_amount,
      };
    });

    const hamali_amount = hamali_override !== null
      ? parseFloat(hamali_override)
      : parseFloat((total_cases * hamaliRate).toFixed(2));

    standard_subtotal = parseFloat(standard_subtotal.toFixed(2));
    vadivel_subtotal = parseFloat(vadivel_subtotal.toFixed(2));
    others_subtotal = parseFloat(others_subtotal.toFixed(2));
    sparklers_subtotal = parseFloat(sparklers_subtotal.toFixed(2));
    guns_subtotal = parseFloat(guns_subtotal.toFixed(2));
    const paid = parseFloat(amount_paid_before || 0);
    const grand_total = Math.round(
      standard_subtotal + vadivel_subtotal + others_subtotal + sparklers_subtotal + guns_subtotal + hamali_amount - paid
    );
    const balance_due = grand_total;

    const bill_number = await generateBillNumber(client, prefix);
    const approval_token = randomUUID();
    const token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const billResult = await client.query(
      `INSERT INTO bills
        (bill_number, customer_id, bill_date, standard_subtotal, vadivel_subtotal,
         others_subtotal, sparklers_subtotal, guns_subtotal, total_cases, hamali_amount,
         amount_paid_before, amount_paid_date, grand_total, balance_due, rp_count, status, approval_token, token_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16,$17)
       RETURNING *`,
      [
        bill_number, customer_id, bill_date || new Date().toISOString().slice(0, 10),
        standard_subtotal, vadivel_subtotal, others_subtotal, sparklers_subtotal, guns_subtotal,
        total_cases, hamali_amount, paid, amount_paid_date || null, grand_total, balance_due,
        rp_count != null ? parseInt(rp_count) || null : null, approval_token, token_expires_at,
      ]
    );

    const bill = billResult.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO bill_items
          (bill_id, category, product_id, item_name, company_name,
           serial_number, cases, boxes, rate_per_box, discount_percent, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          bill.id, item.category, item.product_id, item.item_name, item.company_name,
          item.serial_number, item.cases, item.boxes, item.rate_per_box,
          item.discount_percent, item.total_amount,
        ]
      );
    }

    await client.query('COMMIT');

    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [bill.id]
    );

    res.status(201).json({
      ...bill,
      items: itemsResult.rows,
      approval_link: `http://localhost:5000/api/approval/${approval_token}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/bills/:id/resubmit — resubmit rejected bill
router.put('/:id/resubmit', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found' });
    }
    const {
      items,
      amount_paid_before,
      amount_paid_date = null,
      hamali_override = null,
      customer_id,
      bill_date,
    } = req.body;

    const settings = await getSettings(client);
    const hamaliRate = parseFloat(settings.hamali_rate || 11);

    let standard_subtotal = 0, vadivel_subtotal = 0, others_subtotal = 0, sparklers_subtotal = 0, guns_subtotal = 0, total_cases = 0;

    const processedItems = (items || []).map((item, idx) => {
      const boxes = parseInt(item.boxes || 0, 10);
      const rate = parseFloat(item.rate_per_box || 0);
      const discount = parseFloat(item.discount_percent || 0);
      const cases = parseInt(item.cases || 0, 10);
      const total_amount = parseFloat((boxes * rate * (1 + discount / 100)).toFixed(2));

      if (item.category === 'standard') standard_subtotal += total_amount;
      else if (item.category === 'vadivel') vadivel_subtotal += total_amount;
      else if (item.category === 'sparklers') sparklers_subtotal += total_amount;
      else if (item.category === 'guns') guns_subtotal += total_amount;
      else others_subtotal += total_amount;
      total_cases += cases;

      return { ...item, cases, boxes, rate_per_box: rate, discount_percent: discount, total_amount, serial_number: item.serial_number || idx + 1 };
    });

    const hamali_amount = hamali_override !== null
      ? parseFloat(hamali_override)
      : parseFloat((total_cases * hamaliRate).toFixed(2));

    standard_subtotal = parseFloat(standard_subtotal.toFixed(2));
    vadivel_subtotal = parseFloat(vadivel_subtotal.toFixed(2));
    others_subtotal = parseFloat(others_subtotal.toFixed(2));
    sparklers_subtotal = parseFloat(sparklers_subtotal.toFixed(2));
    guns_subtotal = parseFloat(guns_subtotal.toFixed(2));
    const paid = parseFloat(amount_paid_before || existing.rows[0].amount_paid_before);
    const grand_total = Math.round(
      standard_subtotal + vadivel_subtotal + others_subtotal + sparklers_subtotal + guns_subtotal + hamali_amount - paid
    );

    const new_token = randomUUID();
    const token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await client.query(
      `UPDATE bills SET
        customer_id = COALESCE($1, customer_id),
        bill_date = COALESCE($2, bill_date),
        standard_subtotal=$3, vadivel_subtotal=$4, others_subtotal=$5,
        sparklers_subtotal=$6, guns_subtotal=$7,
        total_cases=$8, hamali_amount=$9, amount_paid_before=$10,
        amount_paid_date=COALESCE($11, amount_paid_date),
        grand_total=$12, balance_due=$12, status='pending',
        rejection_comment=NULL, approval_token=$13, token_expires_at=$14
       WHERE id=$15`,
      [customer_id || null, bill_date || null,
       standard_subtotal, vadivel_subtotal, others_subtotal, sparklers_subtotal, guns_subtotal,
       total_cases, hamali_amount, paid, amount_paid_date || null, grand_total, new_token, token_expires_at, req.params.id]
    );

    if (processedItems.length > 0) {
      await client.query('DELETE FROM bill_items WHERE bill_id = $1', [req.params.id]);
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO bill_items
            (bill_id, category, product_id, item_name, company_name,
             serial_number, cases, boxes, rate_per_box, discount_percent, total_amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [req.params.id, item.category, item.product_id || null, item.item_name,
           item.company_name || null, item.serial_number, item.cases, item.boxes,
           item.rate_per_box, item.discount_percent, item.total_amount]
        );
      }
    }

    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    const updatedItems = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number', [req.params.id]);

    res.json({
      ...updated.rows[0],
      items: updatedItems.rows,
      approval_link: `http://localhost:5000/api/approval/${new_token}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/bills/:id — edit bill, reset status to pending
router.put('/:id', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found' });
    }

    const {
      customer_id,
      bill_date,
      items = [],
      amount_paid_before,
      amount_paid_date = null,
      hamali_override = null,
      rp_count = null,
    } = req.body;

    const settings = await getSettings(client);
    const hamaliRate = parseFloat(settings.hamali_rate || 11);

    let standard_subtotal = 0, vadivel_subtotal = 0, others_subtotal = 0, sparklers_subtotal = 0, guns_subtotal = 0, total_cases = 0;

    const processedItems = items.map((item, idx) => {
      const boxes = parseInt(item.boxes || 0, 10);
      const rate = parseFloat(item.rate_per_box || 0);
      const discount = parseFloat(item.discount_percent || 0);
      const cases = parseInt(item.cases || 0, 10);
      const total_amount = parseFloat((boxes * rate * (1 + discount / 100)).toFixed(2));

      if (item.category === 'standard') standard_subtotal += total_amount;
      else if (item.category === 'vadivel') vadivel_subtotal += total_amount;
      else if (item.category === 'sparklers') sparklers_subtotal += total_amount;
      else if (item.category === 'guns') guns_subtotal += total_amount;
      else others_subtotal += total_amount;
      total_cases += cases;

      return {
        category: item.category,
        product_id: item.product_id || null,
        item_name: item.item_name,
        company_name: item.company_name || null,
        serial_number: item.serial_number || idx + 1,
        cases, boxes, rate_per_box: rate, discount_percent: discount, total_amount,
      };
    });

    const hamali_amount = hamali_override !== null
      ? parseFloat(hamali_override)
      : parseFloat((total_cases * hamaliRate).toFixed(2));

    standard_subtotal = parseFloat(standard_subtotal.toFixed(2));
    vadivel_subtotal = parseFloat(vadivel_subtotal.toFixed(2));
    others_subtotal = parseFloat(others_subtotal.toFixed(2));
    sparklers_subtotal = parseFloat(sparklers_subtotal.toFixed(2));
    guns_subtotal = parseFloat(guns_subtotal.toFixed(2));
    const paid = parseFloat(amount_paid_before !== undefined ? amount_paid_before : existing.rows[0].amount_paid_before);
    const grand_total = Math.round(
      standard_subtotal + vadivel_subtotal + others_subtotal + sparklers_subtotal + guns_subtotal + hamali_amount - paid
    );

    const new_token = randomUUID();
    const token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await client.query(
      `UPDATE bills SET
        customer_id = COALESCE($1, customer_id),
        bill_date = COALESCE($2, bill_date),
        standard_subtotal=$3, vadivel_subtotal=$4, others_subtotal=$5,
        sparklers_subtotal=$6, guns_subtotal=$7,
        total_cases=$8, hamali_amount=$9, amount_paid_before=$10,
        amount_paid_date=COALESCE($11, amount_paid_date),
        grand_total=$12, balance_due=$12, rp_count=$16, status='pending',
        rejection_comment=NULL, approval_token=$13, token_expires_at=$14
       WHERE id=$15`,
      [customer_id || null, bill_date || null,
       standard_subtotal, vadivel_subtotal, others_subtotal, sparklers_subtotal, guns_subtotal,
       total_cases, hamali_amount, paid, amount_paid_date || null, grand_total, new_token, token_expires_at, req.params.id,
       rp_count != null ? parseInt(rp_count) || null : null]
    );

    await client.query('DELETE FROM bill_items WHERE bill_id = $1', [req.params.id]);
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO bill_items
          (bill_id, category, product_id, item_name, company_name,
           serial_number, cases, boxes, rate_per_box, discount_percent, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [req.params.id, item.category, item.product_id, item.item_name, item.company_name,
         item.serial_number, item.cases, item.boxes, item.rate_per_box,
         item.discount_percent, item.total_amount]
      );
    }

    await client.query('COMMIT');

    const updated = await pool.query(
      `SELECT b.*, c.shop_name, c.customer_name, c.phone, c.location
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.id = $1`, [req.params.id]
    );
    const updatedItems = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [req.params.id]
    );

    res.json({
      ...updated.rows[0],
      items: updatedItems.rows,
      approval_link: `http://localhost:5000/api/approval/${new_token}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/bills/:id — update only total_cases, hamali_amount, and rp_count, preserve status
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { total_cases, hamali_amount, rp_count } = req.body;
    const result = await pool.query(
      `UPDATE bills SET
        total_cases = $1,
        hamali_amount = $2,
        rp_count = $4,
        grand_total = ROUND((standard_subtotal + vadivel_subtotal + others_subtotal + sparklers_subtotal + guns_subtotal + $2 - amount_paid_before)::numeric, 0),
        balance_due  = ROUND((standard_subtotal + vadivel_subtotal + others_subtotal + sparklers_subtotal + guns_subtotal + $2 - amount_paid_before)::numeric, 0)
       WHERE id = $3
       RETURNING *`,
      [total_cases, hamali_amount, req.params.id, rp_count != null ? parseInt(rp_count) || null : null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Bill not found' });

    const billRow = result.rows[0];
    const custResult = await pool.query(
      'SELECT shop_name, customer_name, phone, location FROM customers WHERE id = $1',
      [billRow.customer_id]
    );
    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY category, serial_number',
      [billRow.id]
    );
    res.json({ ...billRow, ...custResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bills/clear-all — admin only, season reset
router.delete('/clear-all', authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM bill_items');
    const result = await client.query('DELETE FROM bills');
    await client.query('COMMIT');
    res.json({ message: `Cleared ${result.rowCount} bills`, count: result.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/bills/:id
router.delete('/:id', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM bills WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found' });
    }
    await client.query('DELETE FROM bill_items WHERE bill_id = $1', [req.params.id]);
    await client.query('DELETE FROM bills WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
