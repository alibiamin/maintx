/**
 * API Familles de pièces (référentiel)
 * Multi-tenant : les données sont déjà scopées par req.db (base client ou admin selon req.tenantId).
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare('SELECT * FROM part_families ORDER BY code').all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT * FROM part_families WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Famille non trouvée' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Famille non trouvée' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, description } = req.body;
  let code = codeProvided && String(codeProvided).trim();
  if (!code) code = codification.generateCodeIfNeeded(db, 'part_family', null) || `PF-${Date.now().toString(36).toUpperCase()}`;
  try {
    const r = db.prepare('INSERT INTO part_families (code, name, description) VALUES (?, ?, ?)')
      .run(code, name, description || null);
    const row = db.prepare('SELECT * FROM part_families WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM part_families WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Famille non trouvée' });
  const { code, name, description } = req.body;
  db.prepare('UPDATE part_families SET code = ?, name = ?, description = ? WHERE id = ?')
    .run(code ?? existing.code, name ?? existing.name, description !== undefined ? description : existing.description, id);
  res.json(db.prepare('SELECT * FROM part_families WHERE id = ?').get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM part_families WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Famille non trouvée' });
  res.status(204).send();
});

module.exports = router;
