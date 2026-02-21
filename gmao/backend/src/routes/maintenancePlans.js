/**
 * API Plans de maintenance préventive
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/maintenance-plans
 */
router.get('/', (req, res) => {
  const { equipmentId, isActive } = req.query;
  let sql = `
    SELECT mp.*, e.name as equipment_name, e.code as equipment_code
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE 1=1
  `;
  const params = [];
  if (equipmentId) { sql += ' AND mp.equipment_id = ?'; params.push(equipmentId); }
  if (isActive !== undefined) { sql += ' AND mp.is_active = ?'; params.push(isActive ? 1 : 0); }
  sql += ' ORDER BY mp.next_due_date ASC';
  const rows = db.prepare(sql).all(...params);
  const byId = new Map();
  rows.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
  res.json([...byId.values()]);
});

/**
 * GET /api/maintenance-plans/due
 * Plans dus ou proches (7 jours)
 */
router.get('/due', (req, res) => {
  const rows = db.prepare(`
    SELECT mp.*, e.name as equipment_name, e.code as equipment_code
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE mp.is_active = 1 AND mp.next_due_date <= date('now', '+7 days')
    ORDER BY mp.next_due_date ASC
  `).all();
  const byId = new Map();
  rows.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
  res.json([...byId.values()]);
});

/**
 * POST /api/maintenance-plans
 */
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('equipmentId').isInt(),
  body('name').notEmpty().trim(),
  body('frequencyDays').isInt({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { equipmentId, name, description, frequencyDays } = req.body;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + frequencyDays);
  const result = db.prepare(`
    INSERT INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(equipmentId, name, description || null, frequencyDays, nextDue.toISOString().split('T')[0]);
  const row = db.prepare(`
    SELECT mp.*, e.name as equipment_name, e.code as equipment_code
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE mp.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(row);
});

/**
 * PUT /api/maintenance-plans/:id
 */
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt()
], (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM maintenance_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Plan non trouvé' });
  const { name, description, frequencyDays, isActive, nextDueDate } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (frequencyDays !== undefined) { updates.push('frequency_days = ?'); values.push(frequencyDays); }
  if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
  if (nextDueDate !== undefined) { updates.push('next_due_date = ?'); values.push(nextDueDate); }
  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare(`UPDATE maintenance_plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  const row = db.prepare(`
    SELECT mp.*, e.name as equipment_name, e.code as equipment_code
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE mp.id = ?
  `).get(id);
  res.json(row);
});

/**
 * POST /api/maintenance-plans/:id/execute
 * Marquer comme exécuté et planifier le prochain (work_order_id optionnel pour traçabilité)
 */
router.post('/:id/execute', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  const plan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(id);
  if (!plan) return res.status(404).json({ error: 'Plan non trouvé' });
  const workOrderId = req.body.work_order_id != null ? parseInt(req.body.work_order_id, 10) : null;
  const today = new Date().toISOString().split('T')[0];
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + plan.frequency_days);
  try {
    if (workOrderId != null) {
      db.prepare(`
        UPDATE maintenance_plans SET last_execution_date = ?, next_due_date = ?, last_execution_work_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(today, nextDue.toISOString().split('T')[0], workOrderId, id);
    } else {
      db.prepare(`
        UPDATE maintenance_plans SET last_execution_date = ?, next_due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(today, nextDue.toISOString().split('T')[0], id);
    }
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.prepare(`
        UPDATE maintenance_plans SET last_execution_date = ?, next_due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(today, nextDue.toISOString().split('T')[0], id);
    } else throw e;
  }
  const row = db.prepare(`
    SELECT mp.*, e.name as equipment_name, e.code as equipment_code
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE mp.id = ?
  `).get(id);
  res.json(row);
});

module.exports = router;
