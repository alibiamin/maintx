/**
 * API Causes racines (analyse panne / OT)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const { workOrderId, equipmentId } = req.query;
    let sql = `
      SELECT rc.*, wo.number as wo_number, wo.title as wo_title, e.code as equipment_code, e.name as equipment_name
      FROM equipment_root_causes rc
      JOIN work_orders wo ON rc.work_order_id = wo.id
      LEFT JOIN equipment e ON rc.equipment_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (workOrderId) { sql += ' AND rc.work_order_id = ?'; params.push(workOrderId); }
    if (equipmentId) { sql += ' AND rc.equipment_id = ?'; params.push(equipmentId); }
    sql += ' ORDER BY rc.created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('workOrderId').isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { workOrderId, equipmentId, rootCauseCode, rootCauseDescription, analysisMethod } = req.body;
  try {
    const r = db.prepare(`
      INSERT INTO equipment_root_causes (work_order_id, equipment_id, root_cause_code, root_cause_description, analysis_method, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(workOrderId, equipmentId || null, rootCauseCode || null, rootCauseDescription || null, analysisMethod || null, req.user.id);
    const row = db.prepare(`
      SELECT rc.*, wo.number as wo_number, e.code as equipment_code
      FROM equipment_root_causes rc
      JOIN work_orders wo ON rc.work_order_id = wo.id
      LEFT JOIN equipment e ON rc.equipment_id = e.id
      WHERE rc.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table equipment_root_causes non disponible' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM equipment_root_causes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Cause racine non trouvée' });
  const { equipmentId, rootCauseCode, rootCauseDescription, analysisMethod } = req.body;
  db.prepare(`
    UPDATE equipment_root_causes SET equipment_id = ?, root_cause_code = ?, root_cause_description = ?, analysis_method = ?
    WHERE id = ?
  `).run(equipmentId !== undefined ? equipmentId : existing.equipment_id, rootCauseCode !== undefined ? rootCauseCode : existing.root_cause_code, rootCauseDescription !== undefined ? rootCauseDescription : existing.root_cause_description, analysisMethod !== undefined ? analysisMethod : existing.analysis_method, id);
  res.json(db.prepare(`
    SELECT rc.*, wo.number as wo_number, e.code as equipment_code
    FROM equipment_root_causes rc
    JOIN work_orders wo ON rc.work_order_id = wo.id
    LEFT JOIN equipment e ON rc.equipment_id = e.id
    WHERE rc.id = ?
  `).get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM equipment_root_causes WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Cause racine non trouvée' });
  res.status(204).send();
});

module.exports = router;
