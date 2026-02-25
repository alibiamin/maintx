/**
 * API Contrôles réglementaires / Conformité
 * Contrôles obligatoires par équipement ou site, échéances, statut.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, requirePermission, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ENTITY_TYPES = ['equipment', 'site'];
const CHECK_TYPES = ['periodic', 'legal', 'safety', 'quality'];
const STATUSES = ['ok', 'overdue', 'pending', 'cancelled'];

function formatCheck(row, db) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    checkType: row.check_type,
    frequencyDays: row.frequency_days,
    lastDoneDate: row.last_done_date,
    nextDueDate: row.next_due_date,
    status: row.status,
    documentId: row.document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    entityName: row.entity_name,
    siteName: row.site_name
  };
}

function updateStatus(db, id) {
  const row = db.prepare('SELECT next_due_date, last_done_date FROM regulatory_checks WHERE id = ?').get(id);
  if (!row) return;
  const today = new Date().toISOString().slice(0, 10);
  let status = 'pending';
  if (row.next_due_date < today) status = 'overdue';
  if (row.last_done_date && row.last_done_date >= row.next_due_date) status = 'ok';
  db.prepare('UPDATE regulatory_checks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

router.get('/', requirePermission('regulatory_checks', 'view'), [
  query('entityType').optional().isIn(ENTITY_TYPES),
  query('entityId').optional().isInt(),
  query('status').optional().isIn(STATUSES),
  query('overdue').optional().isIn(['1', 'true'])
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='regulatory_checks'").get();
    if (!hasTable) return res.json([]);
    let sql = `
      SELECT rc.*,
        CASE WHEN rc.entity_type = 'equipment' THEN (SELECT e.name FROM equipment e WHERE e.id = rc.entity_id)
             WHEN rc.entity_type = 'site' THEN (SELECT s.name FROM sites s WHERE s.id = rc.entity_id) END as entity_name,
        CASE WHEN rc.entity_type = 'equipment' THEN (SELECT s.name FROM equipment e JOIN lignes l ON l.id = e.ligne_id JOIN sites s ON s.id = l.site_id WHERE e.id = rc.entity_id)
             WHEN rc.entity_type = 'site' THEN (SELECT name FROM sites WHERE id = rc.entity_id) END as site_name
      FROM regulatory_checks rc
      WHERE rc.status != 'cancelled'
    `;
    const params = [];
    if (req.query.entityType) { sql += ' AND rc.entity_type = ?'; params.push(req.query.entityType); }
    if (req.query.entityId) { sql += ' AND rc.entity_id = ?'; params.push(req.query.entityId); }
    if (req.query.status) { sql += ' AND rc.status = ?'; params.push(req.query.status); }
    if (req.query.overdue === '1' || req.query.overdue === 'true') {
      sql += " AND date(rc.next_due_date) < date('now') AND rc.status != 'ok'";
    }
    sql += ' ORDER BY rc.next_due_date ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatCheck(r, db)));
  } catch (e) {
    console.error('[regulatoryChecks] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('regulatory_checks', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT rc.*,
        CASE WHEN rc.entity_type = 'equipment' THEN (SELECT e.name FROM equipment e WHERE e.id = rc.entity_id)
             ELSE (SELECT s.name FROM sites s WHERE s.id = rc.entity_id) END as entity_name
      FROM regulatory_checks rc WHERE rc.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contrôle réglementaire non trouvé.' });
    res.json(formatCheck(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('regulatory_checks', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('code').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('entityType').isIn(ENTITY_TYPES),
  body('entityId').isInt(),
  body('nextDueDate').notEmpty(),
  body('checkType').optional().isIn(CHECK_TYPES),
  body('frequencyDays').optional().isInt({ min: 1 }),
  body('description').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='regulatory_checks'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table regulatory_checks absente.' });
    const existing = db.prepare('SELECT id FROM regulatory_checks WHERE code = ?').get(req.body.code);
    if (existing) return res.status(400).json({ error: 'Code déjà utilisé.' });
    const { code, name, description, entityType, entityId, checkType, frequencyDays, nextDueDate } = req.body;
    db.prepare(`
      INSERT INTO regulatory_checks (code, name, description, entity_type, entity_id, check_type, frequency_days, next_due_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(code, name, description || null, entityType, entityId, checkType || 'periodic', frequencyDays || null, nextDueDate, req.user.id);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    const row = db.prepare('SELECT * FROM regulatory_checks WHERE id = ?').get(id);
    res.status(201).json(formatCheck(row, db));
  } catch (e) {
    console.error('[regulatoryChecks] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('regulatory_checks', 'update'), param('id').isInt(), [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('checkType').optional().isIn(CHECK_TYPES),
  body('frequencyDays').optional().isInt({ min: 1 }),
  body('lastDoneDate').optional().isISO8601(),
  body('nextDueDate').optional().notEmpty(),
  body('status').optional().isIn(STATUSES),
  body('documentId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id FROM regulatory_checks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contrôle réglementaire non trouvé.' });
    const updates = [];
    const params = [];
    const map = { lastDoneDate: 'last_done_date', nextDueDate: 'next_due_date', checkType: 'check_type', frequencyDays: 'frequency_days', documentId: 'document_id' };
    for (const [k, v] of Object.entries(req.body)) {
      const col = map[k] || k;
      if (['name', 'description', 'check_type', 'frequency_days', 'last_done_date', 'next_due_date', 'status', 'document_id'].includes(col) && v !== undefined) {
        updates.push(`${col} = ?`);
        params.push(v);
      }
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE regulatory_checks SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    updateStatus(db, req.params.id);
    const row = db.prepare('SELECT * FROM regulatory_checks WHERE id = ?').get(req.params.id);
    res.json(formatCheck(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('regulatory_checks', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    db.prepare("UPDATE regulatory_checks SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    const r = db.prepare('SELECT changes() as c').get();
    if (r.c === 0) return res.status(404).json({ error: 'Contrôle réglementaire non trouvé.' });
    res.json({ message: 'Contrôle annulé.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
