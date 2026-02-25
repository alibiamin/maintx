/**
 * API Plan de formation (par technicien)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('training_plans', 'view'), (req, res) => {
  const db = req.db;
  try {
    const { technicianId, status, year } = req.query;
    let sql = `
      SELECT tp.*, tc.code as training_code, tc.name as training_name, tc.validity_months, tc.is_mandatory,
             u.first_name || ' ' || u.last_name as technician_name
      FROM training_plans tp
      JOIN training_catalog tc ON tp.training_catalog_id = tc.id
      JOIN users u ON tp.technician_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (technicianId) { sql += ' AND tp.technician_id = ?'; params.push(technicianId); }
    if (status) { sql += ' AND tp.status = ?'; params.push(status); }
    if (year) { sql += " AND (strftime('%Y', tp.planned_date) = ? OR strftime('%Y', tp.completed_date) = ?)"; params.push(year, year); }
    sql += ' ORDER BY tp.planned_date DESC, tp.id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', requirePermission('training_plans', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT tp.*, tc.code as training_code, tc.name as training_name, tc.duration_hours, tc.validity_months,
             u.first_name || ' ' || u.last_name as technician_name
      FROM training_plans tp
      JOIN training_catalog tc ON tp.training_catalog_id = tc.id
      JOIN users u ON tp.technician_id = u.id
      WHERE tp.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Plan de formation non trouvé' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Plan non trouvé' });
    throw e;
  }
});

router.post('/', requirePermission('training_plans', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('technicianId').isInt(),
  body('trainingCatalogId').isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { technicianId, trainingCatalogId, plannedDate, status, notes } = req.body;
  try {
    const r = db.prepare(`
      INSERT INTO training_plans (technician_id, training_catalog_id, planned_date, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(technicianId, trainingCatalogId, plannedDate || null, status || 'planned', notes || null);
    const row = db.prepare(`
      SELECT tp.*, tc.code as training_code, tc.name as training_name, u.first_name || ' ' || u.last_name as technician_name
      FROM training_plans tp
      JOIN training_catalog tc ON tp.training_catalog_id = tc.id
      JOIN users u ON tp.technician_id = u.id
      WHERE tp.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table training_plans non disponible' });
    throw e;
  }
});

router.put('/:id', requirePermission('training_plans', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM training_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Plan de formation non trouvé' });
  const { technicianId, trainingCatalogId, plannedDate, completedDate, status, notes } = req.body;
  db.prepare(`
    UPDATE training_plans SET technician_id = ?, training_catalog_id = ?, planned_date = ?, completed_date = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(
    technicianId ?? existing.technician_id,
    trainingCatalogId ?? existing.training_catalog_id,
    plannedDate !== undefined ? plannedDate : existing.planned_date,
    completedDate !== undefined ? completedDate : existing.completed_date,
    status ?? existing.status,
    notes !== undefined ? notes : existing.notes,
    id
  );
  res.json(db.prepare(`
    SELECT tp.*, tc.code as training_code, tc.name as training_name, u.first_name || ' ' || u.last_name as technician_name
    FROM training_plans tp
    JOIN training_catalog tc ON tp.training_catalog_id = tc.id
    JOIN users u ON tp.technician_id = u.id
    WHERE tp.id = ?
  `).get(id));
});

router.delete('/:id', requirePermission('training_plans', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM training_plans WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Plan non trouvé' });
  res.status(204).send();
});

module.exports = router;
