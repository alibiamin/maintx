/**
 * API Modèles d'équipements (catalogue / templates)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    manufacturer: row.manufacturer,
    model: row.model,
    technicalSpecs: row.technical_specs ? (typeof row.technical_specs === 'string' ? JSON.parse(row.technical_specs) : row.technical_specs) : null,
    createdAt: row.created_at
  };
}

/**
 * GET /api/equipment-models
 */
router.get('/', requirePermission('equipment_models', 'view'), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM equipment_models m
    LEFT JOIN equipment_categories c ON m.category_id = c.id
    ORDER BY m.name
  `).all();
  res.json(rows.map(formatModel));
});

/**
 * GET /api/equipment-models/:id
 */
router.get('/:id', requirePermission('equipment_models', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM equipment_models m
    LEFT JOIN equipment_categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Modèle non trouvé' });
  res.json(formatModel(row));
});

/**
 * POST /api/equipment-models
 */
router.post('/', requirePermission('equipment_models', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description, categoryId, manufacturer, model, technicalSpecs } = req.body;
  const result = db.prepare(`
    INSERT INTO equipment_models (name, description, category_id, manufacturer, model, technical_specs)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    description || null,
    categoryId || null,
    manufacturer || null,
    model || null,
    technicalSpecs ? JSON.stringify(technicalSpecs) : null
  );
  const row = db.prepare(`
    SELECT m.*, c.name as category_name FROM equipment_models m
    LEFT JOIN equipment_categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(formatModel(row));
});

/**
 * PUT /api/equipment-models/:id
 */
router.put('/:id', requirePermission('equipment_models', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM equipment_models WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Modèle non trouvé' });
  const { name, description, categoryId, manufacturer, model, technicalSpecs } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (categoryId !== undefined) { updates.push('category_id = ?'); params.push(categoryId || null); }
  if (manufacturer !== undefined) { updates.push('manufacturer = ?'); params.push(manufacturer || null); }
  if (model !== undefined) { updates.push('model = ?'); params.push(model || null); }
  if (technicalSpecs !== undefined) { updates.push('technical_specs = ?'); params.push(technicalSpecs ? JSON.stringify(technicalSpecs) : null); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  params.push(id);
  db.prepare(`UPDATE equipment_models SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare(`
    SELECT m.*, c.name as category_name FROM equipment_models m
    LEFT JOIN equipment_categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(id);
  res.json(formatModel(row));
});

/**
 * DELETE /api/equipment-models/:id
 */
router.delete('/:id', requirePermission('equipment_models', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM equipment_models WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Modèle non trouvé' });
  res.status(204).send();
});

module.exports = router;
