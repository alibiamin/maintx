/**
 * API Sous-familles de pièces (référentiel séparé : famille + position 1-5 + code, name)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.db;
  const { familyId } = req.query;
  try {
    let rows;
    if (familyId) {
      rows = db.prepare(`
        SELECT sf.*, pf.code as family_code, pf.name as family_name
        FROM part_sub_families sf
        JOIN part_families pf ON sf.part_family_id = pf.id
        WHERE sf.part_family_id = ?
        ORDER BY sf.part_family_id, sf.position
      `).all(familyId);
    } else {
      rows = db.prepare(`
        SELECT sf.*, pf.code as family_code, pf.name as family_name
        FROM part_sub_families sf
        JOIN part_families pf ON sf.part_family_id = pf.id
        ORDER BY pf.code, sf.position
      `).all();
    }
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
      SELECT sf.*, pf.code as family_code, pf.name as family_name
      FROM part_sub_families sf
      JOIN part_families pf ON sf.part_family_id = pf.id
      WHERE sf.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Sous-famille non trouvée' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Sous-famille non trouvée' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('partFamilyId').isInt(),
  body('position').isInt({ min: 1, max: 5 }),
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { partFamilyId, position, code, name } = req.body;
  const codeVal = (code && String(code).trim()) || `SF-${position}-${Date.now().toString(36)}`;
  try {
    const r = db.prepare('INSERT INTO part_sub_families (part_family_id, position, code, name) VALUES (?, ?, ?, ?)')
      .run(partFamilyId, position, codeVal, name.trim());
    const row = db.prepare('SELECT sf.*, pf.code as family_code, pf.name as family_name FROM part_sub_families sf JOIN part_families pf ON sf.part_family_id = pf.id WHERE sf.id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cette famille a déjà une sous-famille pour cette position' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('position').optional().isInt({ min: 1, max: 5 }),
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM part_sub_families WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Sous-famille non trouvée' });
  const { code, name, position } = req.body;
  db.prepare('UPDATE part_sub_families SET code = ?, name = ?, position = ? WHERE id = ?')
    .run(code ?? existing.code, name ?? existing.name, position ?? existing.position, id);
  const row = db.prepare('SELECT sf.*, pf.code as family_code, pf.name as family_name FROM part_sub_families sf JOIN part_families pf ON sf.part_family_id = pf.id WHERE sf.id = ?').get(id);
  res.json(row);
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM part_sub_families WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Sous-famille non trouvée' });
  res.status(204).send();
});

module.exports = router;
