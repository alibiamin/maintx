/**
 * API Procédures / modes opératoires (liés aux plans ou modèles d'équipement)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatProcedure(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: row.steps,
    safetyNotes: row.safety_notes,
    equipmentModelId: row.equipment_model_id,
    equipmentModelName: row.equipment_model_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/procedures
 * Query: equipmentModelId
 */
router.get('/', (req, res) => {
  const db = req.db;
  const { equipmentModelId } = req.query;
  let sql = `
    SELECT p.*, m.name as equipment_model_name
    FROM procedures p
    LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (equipmentModelId) { sql += ' AND p.equipment_model_id = ?'; params.push(equipmentModelId); }
  sql += ' ORDER BY p.name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(formatProcedure));
});

/**
 * GET /api/procedures/:id
 */
router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare(`
    SELECT p.*, m.name as equipment_model_name
    FROM procedures p
    LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Procédure non trouvée' });
  res.json(formatProcedure(row));
});

/**
 * POST /api/procedures
 */
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description, steps, safetyNotes, equipmentModelId } = req.body;
  const result = db.prepare(`
    INSERT INTO procedures (name, description, steps, safety_notes, equipment_model_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, description || null, steps || null, safetyNotes || null, equipmentModelId || null);
  const row = db.prepare(`
    SELECT p.*, m.name as equipment_model_name FROM procedures p
    LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(formatProcedure(row));
});

/**
 * PUT /api/procedures/:id
 */
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM procedures WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Procédure non trouvée' });
  const { name, description, steps, safetyNotes, equipmentModelId } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (steps !== undefined) { updates.push('steps = ?'); params.push(steps); }
  if (safetyNotes !== undefined) { updates.push('safety_notes = ?'); params.push(safetyNotes); }
  if (equipmentModelId !== undefined) { updates.push('equipment_model_id = ?'); params.push(equipmentModelId || null); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  db.prepare(`UPDATE procedures SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare(`
    SELECT p.*, m.name as equipment_model_name FROM procedures p
    LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
    WHERE p.id = ?
  `).get(id);
  res.json(formatProcedure(row));
});

/**
 * DELETE /api/procedures/:id
 */
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  try {
    db.prepare('UPDATE maintenance_plans SET procedure_id = NULL WHERE procedure_id = ?').run(id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  const result = db.prepare('DELETE FROM procedures WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Procédure non trouvée' });
  res.status(204).send();
});

module.exports = router;
