/**
 * API Satisfaction client / demandeur après clôture OT
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('satisfaction', 'view'), (req, res) => {
  const db = req.db;
  try {
    const { workOrderId } = req.query;
    let sql = `
      SELECT s.*, wo.number as wo_number, wo.title as wo_title
      FROM satisfaction_surveys s
      JOIN work_orders wo ON s.work_order_id = wo.id
      WHERE 1=1
    `;
    const params = [];
    if (workOrderId) { sql += ' AND s.work_order_id = ?'; params.push(workOrderId); }
    sql += ' ORDER BY s.surveyed_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/by-work-order/:workOrderId', requirePermission('satisfaction', 'view'), param('workOrderId').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT s.*, wo.number as wo_number, wo.title as wo_title
      FROM satisfaction_surveys s
      JOIN work_orders wo ON s.work_order_id = wo.id
      WHERE s.work_order_id = ?
    `).get(req.params.workOrderId);
    if (!row) return res.status(200).json(null);
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(200).json(null);
    throw e;
  }
});

router.post('/', requirePermission('satisfaction', 'create'), [
  body('workOrderId').isInt(),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { workOrderId, rating, comment } = req.body;
  try {
    const existing = db.prepare('SELECT id FROM satisfaction_surveys WHERE work_order_id = ?').get(workOrderId);
    if (existing) return res.status(409).json({ error: 'Une enquête existe déjà pour cet OT' });
    const wo = db.prepare('SELECT id, status FROM work_orders WHERE id = ?').get(workOrderId);
    if (!wo) return res.status(404).json({ error: 'OT non trouvé' });
    const r = db.prepare(`
      INSERT INTO satisfaction_surveys (work_order_id, rating, comment) VALUES (?, ?, ?)
    `).run(workOrderId, rating || null, comment || null);
    const row = db.prepare(`
      SELECT s.*, wo.number as wo_number, wo.title as wo_title
      FROM satisfaction_surveys s
      JOIN work_orders wo ON s.work_order_id = wo.id
      WHERE s.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table satisfaction_surveys non disponible' });
    throw e;
  }
});

router.put('/:id', param('id').isInt(), [
  body('rating').optional().isInt({ min: 1, max: 5 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM satisfaction_surveys WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Enquête non trouvée' });
  const { rating, comment } = req.body;
  db.prepare('UPDATE satisfaction_surveys SET rating = ?, comment = ? WHERE id = ?')
    .run(rating !== undefined ? rating : existing.rating, comment !== undefined ? comment : existing.comment, id);
  res.json(db.prepare(`
    SELECT s.*, wo.number as wo_number, wo.title as wo_title
    FROM satisfaction_surveys s
    JOIN work_orders wo ON s.work_order_id = wo.id
    WHERE s.id = ?
  `).get(id));
});

module.exports = router;
