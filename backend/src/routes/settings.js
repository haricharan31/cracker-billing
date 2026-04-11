const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

const TUNNEL_LOG = path.join('C:\\crackers-billing', 'tunnel.log');

const router = express.Router();

// GET /api/settings
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY key');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/tunnel-url — reads cloudflared log and returns detected URL
router.get('/tunnel-url', authenticate, async (req, res) => {
  try {
    if (!fs.existsSync(TUNNEL_LOG)) {
      return res.status(404).json({ error: 'Tunnel not running (log file not found)' });
    }
    const log = fs.readFileSync(TUNNEL_LOG, 'utf8');
    const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!match) {
      return res.status(404).json({ error: 'Tunnel URL not found in log — tunnel may still be starting' });
    }
    res.json({ url: match[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — body: { key, value }
router.put('/', authenticate, requireAdmin, async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const result = await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING *`,
      [key, value]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
