const express = require('express');
const pool = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

const router = express.Router();

// Generate unique item_code from item_name + category
async function generateItemCode(itemName, category) {
  const base = (itemName.slice(0, 3) + category.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  let code = base;
  let suffix = 1;
  while (true) {
    const exists = await pool.query('SELECT id FROM products WHERE item_code = $1', [code]);
    if (exists.rows.length === 0) return code;
    code = base + suffix++;
  }
}

// GET /api/products
router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += ' ORDER BY created_at ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/search?q=&category=
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, category } = req.query;
    if (!q) return res.json([]);
    const params = [`%${q}%`];
    let query = `SELECT * FROM products WHERE is_active = true
       AND (item_name ILIKE $1 OR item_code ILIKE $1 OR company_name ILIKE $1)`;
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += ` ORDER BY created_at ASC LIMIT 8`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', authenticate, async (req, res) => {
  const { category, item_name, boxes_per_case, price_per_box, company_name } = req.body;
  if (!category || !item_name) {
    return res.status(400).json({ error: 'category and item_name required' });
  }
  try {
    // Return 409 if same item_name + category already exists
    const existing = await pool.query(
      'SELECT id FROM products WHERE item_name ILIKE $1 AND category = $2 AND is_active = true',
      [item_name, category]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Product already exists', id: existing.rows[0].id });
    }
    const item_code = await generateItemCode(item_name, category);
    const result = await pool.query(
      `INSERT INTO products (category, item_name, item_code, boxes_per_case, price_per_box, company_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [category, item_name, item_code, boxes_per_case || 12, price_per_box || 0, company_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { category, item_name, boxes_per_case, price_per_box, company_name } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET
         category = COALESCE($1, category),
         item_name = COALESCE($2, item_name),
         boxes_per_case = COALESCE($3, boxes_per_case),
         price_per_box = COALESCE($4, price_per_box),
         company_name = COALESCE($5, company_name)
       WHERE id = $6 RETURNING *`,
      [category, item_name, boxes_per_case, price_per_box, company_name, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
