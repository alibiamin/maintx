/**
 * API Gestion des arrêts planifiés (planned shutdowns)
 * Calendrier des arrêts, rattachement d'OT, remise en service.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const IMPACT_LEVELS = ['low', 'medium', 'high', 'critical'];

function formatShutdown(row, db) {
  if (!row) return null;
  const workOrders = db ? db.prepare(`
    SELECT wo.id, wo.number, wo.title, wo.status
    FROM shutdown_work_orders swo
    JOIN work_orders wo ON wo.id = swo.work_order_id
    WHERE swo.shutdown_id = ?
  `).all(row.id) : [];
  return {
    id: row.id,
    shutdownNumber: row.shutdown_number,
    name: row.name,
    description: row.description,
    equipmentId: row.equipment_id,
    siteId: row.site_id,
    startDate: row.start_date,
    endDate: row.end_date,
    durationHours: row.duration_hours,
    reason: row.reason,
    impactLevel: row.impact_level,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workOrders: workOrders.map(wo => ({ id: wo.id, number: wo.number, title: wo.title, status: wo.status }))
  };
}

function nextShutdownNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT shutdown_number FROM planned_shutdowns WHERE shutdown_number LIKE ? ORDER BY id DESC LIMIT 1').get(`ARR-${year}-%`);
  const num = last ? parseInt(String(last.shutdown_number).split('-')[2]) + 1 : 1;
  return `ARR-${year}-${String(num).padStart(4, '0')}`;
}

router.get('/', requirePermission('planned_shutdowns', 'view'), [
  query('status').optional().isIn(STATUSES),
  query('siteId').optional().isInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_shutdowns'").get();
    if (!hasTable) return res.json([]);
    let sql = `
      SELECT ps.*, s.name as site_name
      FROM planned_shutdowns ps
      LEFT JOIN sites s ON s.id = ps.site_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.status) { sql += ' AND ps.status = ?'; params.push(req.query.status); }
    if (req.query.siteId) { sql += ' AND ps.site_id = ?'; params.push(req.query.siteId); }
    if (req.query.from) { sql += ' AND date(ps.end_date) >= date(?)'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND date(ps.start_date) <= date(?)'; params.push(req.query.to); }
    sql += ' ORDER BY ps.start_date DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatShutdown(r, db)));
  } catch (e) {
    console.error('[plannedShutdowns] list', e);
    res.status(500).json({ error: 'Erreur lors du chargement des arrêts planifiés.' });
  }
});

router.get('/:id', requirePermission('planned_shutdowns', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const row = db.prepare(`
      SELECT ps.*, s.name as site_name, e.name as equipment_name, e.code as equipment_code
      FROM planned_shutdowns ps
      LEFT JOIN sites s ON s.id = ps.site_id
      LEFT JOIN equipment e ON e.id = ps.equipment_id
      WHERE ps.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Arrêt planifié non trouvé.' });
    res.json(formatShutdown(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('planned_shutdowns', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.PLANIFICATEUR), [
  body('name').trim().notEmpty(),
  body('startDate').notEmpty(),
  body('endDate').notEmpty(),
  body('siteId').optional().isInt(),
  body('equipmentId').optional().isInt(),
  body('durationHours').optional().isFloat({ min: 0 }),
  body('reason').optional().trim(),
  body('impactLevel').optional().isIn(IMPACT_LEVELS),
  body('description').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_shutdowns'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table planned_shutdowns absente.' });
    const shutdownNumber = nextShutdownNumber(db);
    const { name, startDate, endDate, siteId, equipmentId, durationHours, reason, impactLevel, description } = req.body;
    db.prepare(`
      INSERT INTO planned_shutdowns (shutdown_number, name, description, equipment_id, site_id, start_date, end_date, duration_hours, reason, impact_level, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)
    `).run(shutdownNumber, name, description || null, equipmentId || null, siteId || null, startDate, endDate, durationHours || null, reason || null, impactLevel || 'medium', req.user.id);
    const row = db.prepare('SELECT * FROM planned_shutdowns WHERE id = last_insert_rowid()').get();
    res.status(201).json(formatShutdown(row, db));
  } catch (e) {
    console.error('[plannedShutdowns] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('planned_shutdowns', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.PLANIFICATEUR), param('id').isInt(), [
  body('name').optional().trim().notEmpty(),
  body('startDate').optional().notEmpty(),
  body('endDate').optional().notEmpty(),
  body('siteId').optional().isInt(),
  body('equipmentId').optional().isInt(),
  body('durationHours').optional().isFloat({ min: 0 }),
  body('reason').optional().trim(),
  body('impactLevel').optional().isIn(IMPACT_LEVELS),
  body('status').optional().isIn(STATUSES),
  body('description').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id FROM planned_shutdowns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Arrêt planifié non trouvé.' });
    const updates = [];
    const params = [];
    const allowed = ['name', 'description', 'start_date', 'end_date', 'duration_hours', 'reason', 'impact_level', 'status', 'site_id', 'equipment_id'];
    const bodyMap = { startDate: 'start_date', endDate: 'end_date', durationHours: 'duration_hours', impactLevel: 'impact_level', siteId: 'site_id', equipmentId: 'equipment_id' };
    for (const [k, v] of Object.entries(req.body)) {
      const col = bodyMap[k] || k;
      if (allowed.includes(col) && v !== undefined) { updates.push(`${col} = ?`); params.push(v); }
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE planned_shutdowns SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    const row = db.prepare('SELECT * FROM planned_shutdowns WHERE id = ?').get(req.params.id);
    res.json(formatShutdown(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/work-orders', requirePermission('planned_shutdowns', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.PLANIFICATEUR), param('id').isInt(), body('workOrderId').isInt(), (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const shutdown = db.prepare('SELECT id FROM planned_shutdowns WHERE id = ?').get(req.params.id);
    if (!shutdown) return res.status(404).json({ error: 'Arrêt planifié non trouvé.' });
    const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.body.workOrderId);
    if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé.' });
    db.prepare('INSERT OR IGNORE INTO shutdown_work_orders (shutdown_id, work_order_id) VALUES (?, ?)').run(req.params.id, req.body.workOrderId);
    const row = db.prepare('SELECT * FROM planned_shutdowns WHERE id = ?').get(req.params.id);
    res.json(formatShutdown(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/work-orders/:workOrderId', requirePermission('planned_shutdowns', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.PLANIFICATEUR), param('id').isInt(), param('workOrderId').isInt(), (req, res) => {
  const db = req.db;
  try {
    db.prepare('DELETE FROM shutdown_work_orders WHERE shutdown_id = ? AND work_order_id = ?').run(req.params.id, req.params.workOrderId);
    const row = db.prepare('SELECT * FROM planned_shutdowns WHERE id = ?').get(req.params.id);
    res.json(formatShutdown(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('planned_shutdowns', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    db.prepare('DELETE FROM shutdown_work_orders WHERE shutdown_id = ?').run(req.params.id);
    const r = db.prepare('DELETE FROM planned_shutdowns WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Arrêt planifié non trouvé.' });
    res.json({ message: 'Arrêt planifié supprimé.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
