/**
 * API Catalogue des formations
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare('SELECT * FROM training_catalog ORDER BY code').all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT * FROM training_catalog WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Formation non trouvée' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Formation non trouvée' });
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
  const { code, name, description, durationHours, validityMonths, isMandatory } = req.body;
  const codeVal = (code && String(code).trim()) || `F-${Date.now().toString(36).toUpperCase()}`;
  try {
    const r = db.prepare(`
      INSERT INTO training_catalog (code, name, description, duration_hours, validity_months, is_mandatory)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(codeVal, name, description || null, durationHours != null ? Number(durationHours) : 0, validityMonths != null ? parseInt(validityMonths, 10) : null, isMandatory ? 1 : 0);
    const row = db.prepare('SELECT * FROM training_catalog WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM training_catalog WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Formation non trouvée' });
  const { code, name, description, durationHours, validityMonths, isMandatory } = req.body;
  db.prepare(`
    UPDATE training_catalog SET code = ?, name = ?, description = ?, duration_hours = ?, validity_months = ?, is_mandatory = ?
    WHERE id = ?
  `).run(
    code ?? existing.code,
    name ?? existing.name,
    description !== undefined ? description : existing.description,
    durationHours !== undefined ? Number(durationHours) : existing.duration_hours,
    validityMonths !== undefined ? (validityMonths == null ? null : parseInt(validityMonths, 10)) : existing.validity_months,
    isMandatory !== undefined ? (isMandatory ? 1 : 0) : existing.is_mandatory,
    id
  );
  res.json(db.prepare('SELECT * FROM training_catalog WHERE id = ?').get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM training_catalog WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Formation non trouvée' });
  res.status(204).send();
});

module.exports = router;
