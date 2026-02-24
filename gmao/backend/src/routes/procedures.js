/**
 * API Procédures / modes opératoires (liés aux plans ou modèles d'équipement)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const PROCEDURE_TYPES = ['maintenance', 'test', 'operating_mode'];

function formatProcedure(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: row.steps,
    safetyNotes: row.safety_notes,
    procedureType: row.procedure_type || 'maintenance',
    code: row.code || null,
    equipmentModelId: row.equipment_model_id,
    equipmentModelName: row.equipment_model_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/procedures
 * Query: equipmentModelId, procedureType (maintenance | test | operating_mode)
 */
router.get('/', (req, res) => {
  const db = req.db;
  const { equipmentModelId, procedureType } = req.query;
  let sql = `
    SELECT p.*, m.name as equipment_model_name
    FROM procedures p
    LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (equipmentModelId) { sql += ' AND p.equipment_model_id = ?'; params.push(equipmentModelId); }
  if (procedureType && PROCEDURE_TYPES.includes(procedureType)) {
    sql += ' AND (p.procedure_type = ? OR (p.procedure_type IS NULL AND ? = \'maintenance\'))';
    params.push(procedureType, procedureType);
  }
  sql += ' ORDER BY COALESCE(p.procedure_type,\'maintenance\'), p.code, p.name';
  let rows;
  try {
    rows = db.prepare(sql).all(...params);
  } catch (e) {
    if (e.message && e.message.includes('no such column') && (e.message.includes('procedure_type') || e.message.includes('code'))) {
      sql = `
        SELECT p.*, m.name as equipment_model_name
        FROM procedures p
        LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
        WHERE 1=1
      `;
      const baseParams = [];
      if (equipmentModelId) { sql += ' AND p.equipment_model_id = ?'; baseParams.push(equipmentModelId); }
      sql += ' ORDER BY p.name';
      rows = db.prepare(sql).all(...baseParams);
    } else throw e;
  }
  res.json(rows.map(formatProcedure));
});

/**
 * GET /api/procedures/:id/usage
 * Liaisons : plans de maintenance et OT qui utilisent cette procédure.
 */
router.get('/:id/usage', param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const proc = db.prepare('SELECT id FROM procedures WHERE id = ?').get(id);
  if (!proc) return res.status(404).json({ error: 'Procédure non trouvée' });
  let maintenancePlans = [];
  let workOrders = [];
  try {
    maintenancePlans = db.prepare(`
      SELECT mp.id, mp.name, mp.next_due_date, e.code as equipment_code, e.name as equipment_name
      FROM maintenance_plans mp
      LEFT JOIN equipment e ON mp.equipment_id = e.id
      WHERE mp.procedure_id = ?
    `).all(id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  try {
    workOrders = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.status
      FROM work_order_procedures wop
      JOIN work_orders wo ON wop.work_order_id = wo.id
      WHERE wop.procedure_id = ?
    `).all(id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  try {
    const woByProcedureId = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.status
      FROM work_orders wo
      WHERE wo.procedure_id = ?
    `).all(id);
    const woIds = new Set(workOrders.map((r) => r.id));
    woByProcedureId.forEach((r) => { if (!woIds.has(r.id)) workOrders.push(r); });
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) { /* ignore */ }
  }
  res.json({ maintenancePlans, workOrders });
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
  body('name').notEmpty().trim(),
  body('procedureType').optional().isIn(PROCEDURE_TYPES),
  body('code').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description, steps, safetyNotes, equipmentModelId, procedureType, code } = req.body;
  const type = procedureType && PROCEDURE_TYPES.includes(procedureType) ? procedureType : 'maintenance';
  try {
    const result = db.prepare(`
      INSERT INTO procedures (name, description, steps, safety_notes, equipment_model_id, procedure_type, code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || null, steps || null, safetyNotes || null, equipmentModelId || null, type, code || null);
    const row = db.prepare(`
      SELECT p.*, m.name as equipment_model_name FROM procedures p
      LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
    return res.status(201).json(formatProcedure(row));
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      const result = db.prepare(`
        INSERT INTO procedures (name, description, steps, safety_notes, equipment_model_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, description || null, steps || null, safetyNotes || null, equipmentModelId || null);
      const row = db.prepare(`
        SELECT p.*, m.name as equipment_model_name FROM procedures p
        LEFT JOIN equipment_models m ON p.equipment_model_id = m.id
        WHERE p.id = ?
      `).get(result.lastInsertRowid);
      return res.status(201).json(formatProcedure(row));
    }
    throw e;
  }
});

/**
 * PUT /api/procedures/:id
 */
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim(),
  body('procedureType').optional().isIn(PROCEDURE_TYPES),
  body('code').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM procedures WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Procédure non trouvée' });
  const { name, description, steps, safetyNotes, equipmentModelId, procedureType, code } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (steps !== undefined) { updates.push('steps = ?'); params.push(steps); }
  if (safetyNotes !== undefined) { updates.push('safety_notes = ?'); params.push(safetyNotes); }
  if (equipmentModelId !== undefined) { updates.push('equipment_model_id = ?'); params.push(equipmentModelId || null); }
  if (procedureType !== undefined && PROCEDURE_TYPES.includes(procedureType)) { updates.push('procedure_type = ?'); params.push(procedureType); }
  if (code !== undefined) { updates.push('code = ?'); params.push(code || null); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  try {
    db.prepare(`UPDATE procedures SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      const withoutNewCols = [];
      const withoutNewParams = [];
      updates.forEach((u, i) => {
        if (u === 'updated_at = CURRENT_TIMESTAMP' || (u !== 'procedure_type = ?' && u !== 'code = ?')) {
          withoutNewCols.push(u);
          if (i < params.length) withoutNewParams.push(params[i]);
        }
      });
      if (withoutNewCols.length > 1) db.prepare(`UPDATE procedures SET ${withoutNewCols.join(', ')} WHERE id = ?`).run(...withoutNewParams);
    } else throw e;
  }
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
