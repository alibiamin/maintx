/**
 * API Emplacements de stock
 * Multi-tenant : les données sont déjà scopées par req.db (base client ou admin selon req.tenantId).
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const { siteId } = req.query;
    let sql = `
      SELECT sl.*, s.name as site_name
      FROM stock_locations sl
      LEFT JOIN sites s ON sl.site_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (siteId) { sql += ' AND sl.site_id = ?'; params.push(siteId); }
    sql += ' ORDER BY sl.code';
    const rows = db.prepare(sql).all(...params);
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
      SELECT sl.*, s.name as site_name
      FROM stock_locations sl
      LEFT JOIN sites s ON sl.site_id = s.id
      WHERE sl.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Emplacement non trouvé' });
    const parts = db.prepare(`
      SELECT spl.*, sp.code as part_code, sp.name as part_name
      FROM spare_part_locations spl
      JOIN spare_parts sp ON spl.spare_part_id = sp.id
      WHERE spl.location_id = ?
    `).all(req.params.id);
    res.json({ ...row, parts });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Emplacement non trouvé' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim(),
  body('code').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code, name, description, siteId } = req.body;
  const codeVal = (code && String(code).trim()) || `LOC-${Date.now().toString(36).toUpperCase()}`;
  try {
    const r = db.prepare(`
      INSERT INTO stock_locations (code, name, description, site_id) VALUES (?, ?, ?, ?)
    `).run(codeVal, name, description || null, siteId || null);
    const row = db.prepare(`
      SELECT sl.*, s.name as site_name FROM stock_locations sl
      LEFT JOIN sites s ON sl.site_id = s.id WHERE sl.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM stock_locations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Emplacement non trouvé' });
  const { code, name, description, siteId } = req.body;
  db.prepare(`
    UPDATE stock_locations SET code = ?, name = ?, description = ?, site_id = ? WHERE id = ?
  `).run(code ?? existing.code, name ?? existing.name, description !== undefined ? description : existing.description, siteId !== undefined ? siteId : existing.site_id, id);
  res.json(db.prepare(`
    SELECT sl.*, s.name as site_name FROM stock_locations sl
    LEFT JOIN sites s ON sl.site_id = s.id WHERE sl.id = ?
  `).get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM stock_locations WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Emplacement non trouvé' });
  res.status(204).send();
});

module.exports = router;
