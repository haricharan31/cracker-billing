const express = require('express');
const pool = require('../config/database');
const authenticate = require('../middleware/auth');

const router = express.Router();

// GET /api/customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE shop_name ILIKE $1 OR customer_name ILIKE $1 OR phone ILIKE $1`;
    }
    query += ' ORDER BY shop_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', authenticate, async (req, res) => {
  const { shop_name, customer_name, phone, location } = req.body;
  if (!shop_name || !customer_name) {
    return res.status(400).json({ error: 'shop_name and customer_name required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO customers (shop_name, customer_name, phone, location) VALUES ($1, $2, $3, $4) RETURNING *',
      [shop_name, customer_name, phone || null, location || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, async (req, res) => {
  const { shop_name, customer_name, phone, location } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers SET
         shop_name = COALESCE($1, shop_name),
         customer_name = COALESCE($2, customer_name),
         phone = COALESCE($3, phone),
         location = COALESCE($4, location)
       WHERE id = $5 RETURNING *`,
      [shop_name, customer_name, phone, location, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const billCheck = await pool.query('SELECT id FROM bills WHERE customer_id = $1 LIMIT 1', [req.params.id]);
    if (billCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete customer with existing bills. Delete their bills first.' });
    }
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
