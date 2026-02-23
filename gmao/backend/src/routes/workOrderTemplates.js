/**
 * API Modèles d'ordres de travail (templates)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT t.*, wot.name as type_name, wot.color as type_color
      FROM work_order_templates t
      LEFT JOIN work_order_types wot ON t.type_id = wot.id
      ORDER BY t.name
    `).all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT t.*, wot.name as type_name
      FROM work_order_templates t
      LEFT JOIN work_order_types wot ON t.type_id = wot.id
      WHERE t.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Modèle non trouvé' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Modèle non trouvé' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description, typeId, defaultPriority, estimatedHours, checklistTemplate } = req.body;
  try {
    const r = db.prepare(`
      INSERT INTO work_order_templates (name, description, type_id, default_priority, estimated_hours, checklist_template)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description || null, typeId || null, defaultPriority || 'medium', estimatedHours != null ? Number(estimatedHours) : 0, checklistTemplate || null);
    const row = db.prepare(`
      SELECT t.*, wot.name as type_name FROM work_order_templates t
      LEFT JOIN work_order_types wot ON t.type_id = wot.id WHERE t.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_templates non disponible' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM work_order_templates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Modèle non trouvé' });
  const { name, description, typeId, defaultPriority, estimatedHours, checklistTemplate } = req.body;
  db.prepare(`
    UPDATE work_order_templates SET name = ?, description = ?, type_id = ?, default_priority = ?, estimated_hours = ?, checklist_template = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(name ?? existing.name, description !== undefined ? description : existing.description, typeId !== undefined ? typeId : existing.type_id, defaultPriority ?? existing.default_priority, estimatedHours !== undefined ? Number(estimatedHours) : existing.estimated_hours, checklistTemplate !== undefined ? checklistTemplate : existing.checklist_template, id);
  res.json(db.prepare(`
    SELECT t.*, wot.name as type_name FROM work_order_templates t
    LEFT JOIN work_order_types wot ON t.type_id = wot.id WHERE t.id = ?
  `).get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM work_order_templates WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Modèle non trouvé' });
  res.status(204).send();
});

module.exports = router;
