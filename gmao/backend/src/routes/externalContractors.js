/**
 * API Sous-traitants / Intervenants externes
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

function generateContractorNumber(db) {
  try {
    const last = db.prepare('SELECT code FROM external_contractors WHERE code LIKE ? ORDER BY id DESC LIMIT 1').get('EXT-%');
    const n = last ? parseInt(last.code.replace('EXT-', ''), 10) + 1 : 1;
    return `EXT-${String(n).padStart(4, '0')}`;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return `EXT-${Date.now().toString(36).toUpperCase()}`;
    throw e;
  }
}

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM external_contractors WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (code LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY name';
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
    const row = db.prepare('SELECT * FROM external_contractors WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Sous-traitant non trouvé' });
    const orders = db.prepare(`
      SELECT so.*, wo.number as wo_number, wo.title as wo_title
      FROM subcontract_orders so
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      WHERE so.contractor_id = ?
      ORDER BY so.created_at DESC
    `).all(req.params.id);
    res.json({ ...row, orders });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Sous-traitant non trouvé' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, contactPerson, email, phone, address, notes } = req.body;
  const code = (codeProvided && String(codeProvided).trim()) || codification.generateCodeIfNeeded(db, 'external_contractor', null) || generateContractorNumber(db);
  try {
    const r = db.prepare(`
      INSERT INTO external_contractors (code, name, contact_person, email, phone, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, contactPerson || null, email || null, phone || null, address || null, notes || null);
    const row = db.prepare('SELECT * FROM external_contractors WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM external_contractors WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Sous-traitant non trouvé' });
  const { code, name, contactPerson, email, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE external_contractors SET code = ?, name = ?, contact_person = ?, email = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(code ?? existing.code, name ?? existing.name, contactPerson !== undefined ? contactPerson : existing.contact_person, email !== undefined ? email : existing.email, phone !== undefined ? phone : existing.phone, address !== undefined ? address : existing.address, notes !== undefined ? notes : existing.notes, id);
  res.json(db.prepare('SELECT * FROM external_contractors WHERE id = ?').get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM external_contractors WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Sous-traitant non trouvé' });
  res.status(204).send();
});

module.exports = router;
