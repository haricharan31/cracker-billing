function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
}

module.exports = { requireAdmin };
