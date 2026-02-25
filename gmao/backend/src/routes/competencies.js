/**
 * API Compétences (pour techniciens)
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('competencies', 'view'), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT id, code, name, description, created_at
    FROM competencies
    ORDER BY name
  `).all();
  res.json(rows);
});

router.get('/:id', requirePermission('competencies', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare('SELECT id, code, name, description, created_at FROM competencies WHERE id = ?').get(parseInt(req.params.id));
  if (!row) return res.status(404).json({ error: 'Compétence introuvable' });
  res.json(row);
});

router.post('/', requirePermission('competencies', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('code').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('description').optional().trim()
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const { code, name, description } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO competencies (code, name, description) VALUES (?, ?, ?)
    `).run(code, name || null, description || null);
    const row = db.prepare('SELECT id, code, name, description, created_at FROM competencies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà utilisé' });
    throw e;
  }
});

router.put('/:id', [
  param('id').isInt(),
  body('code').optional().notEmpty().trim(),
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim()
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const id = parseInt(req.params.id);
  const { code, name, description } = req.body;
  const updates = [];
  const values = [];
  if (code !== undefined) { updates.push('code = ?'); values.push(code); }
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
  values.push(id);
  try {
    db.prepare('UPDATE competencies SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
    const row = db.prepare('SELECT id, code, name, description, created_at FROM competencies WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Compétence introuvable' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà utilisé' });
    throw e;
  }
});

router.delete('/:id', requirePermission('competencies', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id);
  db.prepare('DELETE FROM competencies WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
