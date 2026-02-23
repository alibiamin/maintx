/**
 * API Codes défaut / Causes de panne
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  const rows = db.prepare('SELECT * FROM failure_codes ORDER BY category, code').all();
  res.json(rows);
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, description, category } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'code_defaut', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const r = db.prepare('INSERT INTO failure_codes (code, name, description, category) VALUES (?, ?, ?, ?)')
      .run(code.trim(), name, description || null, category || null);
    const row = db.prepare('SELECT * FROM failure_codes WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM failure_codes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Code non trouvé' });
  const { code, name, description, category } = req.body;
  db.prepare('UPDATE failure_codes SET code = ?, name = ?, description = ?, category = ? WHERE id = ?')
    .run(code || existing.code, name || existing.name, description, category, id);
  res.json(db.prepare('SELECT * FROM failure_codes WHERE id = ?').get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM failure_codes WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Code non trouvé' });
  res.status(204).send();
});

module.exports = router;
