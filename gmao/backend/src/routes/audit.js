/**
 * API Journal d'audit — consultation des créations / modifications / suppressions
 */
const express = require('express');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/audit
 * Query: entityType, entityId, startDate, endDate, limit (default 100)
 */
router.get('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const { entityType, entityId, startDate, endDate, limit } = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (entityType) { where += ' AND entity_type = ?'; params.push(entityType); }
  if (entityId) { where += ' AND entity_id = ?'; params.push(String(entityId)); }
  if (startDate) { where += ' AND date(created_at) >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND date(created_at) <= ?'; params.push(endDate); }
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT id, entity_type, entity_id, action, user_id, user_email, summary, created_at
      FROM audit_log
      ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params, lim);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) return res.status(500).json({ error: e.message });
  }
  res.json(rows.map(r => ({
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    userId: r.user_id,
    userEmail: r.user_email,
    summary: r.summary,
    createdAt: r.created_at
  })));
});

module.exports = router;
