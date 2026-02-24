/**
 * API Stock par site/emplacement
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  const { siteId, sparePartId } = req.query;
  try {
    let sql = `
      SELECT sbs.id, sbs.site_id, sbs.spare_part_id, sbs.quantity, sbs.updated_at,
             s.name as site_name, sp.code as part_code, sp.name as part_name, sp.unit
      FROM stock_by_site sbs
      JOIN sites s ON sbs.site_id = s.id
      JOIN spare_parts sp ON sbs.spare_part_id = sp.id
      WHERE 1=1
    `;
    const params = [];
    if (siteId) { sql += ' AND sbs.site_id = ?'; params.push(siteId); }
    if (sparePartId) { sql += ' AND sbs.spare_part_id = ?'; params.push(sparePartId); }
    sql += ' ORDER BY s.name, sp.code';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/summary', (req, res) => {
  const db = req.db;
  const { siteId } = req.query;
  try {
    let sql = `
      SELECT sbs.site_id, s.name as site_name, COUNT(DISTINCT sbs.spare_part_id) as part_count,
             COALESCE(SUM(sbs.quantity), 0) as total_quantity
      FROM stock_by_site sbs
      JOIN sites s ON sbs.site_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (siteId) { sql += ' AND sbs.site_id = ?'; params.push(siteId); }
    sql += ' GROUP BY sbs.site_id';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.put('/:siteId/:sparePartId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  param('siteId').isInt(),
  param('sparePartId').isInt(),
  body('quantity').isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const siteId = parseInt(req.params.siteId, 10);
  const sparePartId = parseInt(req.params.sparePartId, 10);
  const quantity = parseFloat(req.body.quantity);
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  const part = db.prepare('SELECT id FROM spare_parts WHERE id = ?').get(sparePartId);
  if (!site || !part) return res.status(404).json({ error: 'Site ou pièce non trouvé' });
  try {
    const existing = db.prepare('SELECT id, quantity FROM stock_by_site WHERE site_id = ? AND spare_part_id = ?').get(siteId, sparePartId);
    if (existing) {
      db.prepare('UPDATE stock_by_site SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE site_id = ? AND spare_part_id = ?').run(quantity, siteId, sparePartId);
    } else {
      db.prepare('INSERT INTO stock_by_site (site_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(siteId, sparePartId, quantity);
    }
    const row = db.prepare(`
      SELECT sbs.*, s.name as site_name, sp.code as part_code, sp.name as part_name
      FROM stock_by_site sbs
      JOIN sites s ON sbs.site_id = s.id
      JOIN spare_parts sp ON sbs.spare_part_id = sp.id
      WHERE sbs.site_id = ? AND sbs.spare_part_id = ?
    `).get(siteId, sparePartId);
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table stock_by_site absente.' });
    throw e;
  }
});

module.exports = router;
