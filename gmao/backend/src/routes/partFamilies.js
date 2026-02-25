/**
 * API Familles de pièces (référentiel)
 * Multi-tenant : les données sont déjà scopées par req.db (base client ou admin selon req.tenantId).
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('part_families', 'view'), (req, res) => {
  const db = req.db;
  try {
    const hasCategory = db.prepare("SELECT 1 FROM pragma_table_info('part_families') WHERE name = 'category_id'").get();
    if (!hasCategory) {
      const rows = db.prepare('SELECT * FROM part_families ORDER BY code').all();
      return res.json(rows);
    }
    try {
      const rows = db.prepare(`SELECT pf.*, pc.code as category_code, pc.name as category_name FROM part_families pf LEFT JOIN part_categories pc ON pf.category_id = pc.id ORDER BY pc.code, pf.code`).all();
      return res.json(rows);
    } catch (e2) {
      if (e2.message && e2.message.includes('no such table')) return res.json(db.prepare('SELECT * FROM part_families ORDER BY code').all());
      throw e2;
    }
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', requirePermission('part_families', 'view'), param('id').isInt(), (req, res) => {
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

router.post('/', requirePermission('part_families', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, description, categoryId, subFamily1, subFamily2, subFamily3, subFamily4, subFamily5 } = req.body;
  let code = codeProvided && String(codeProvided).trim();
  if (!code) code = codification.generateCodeIfNeeded(db, 'part_family', null) || `PF-${Date.now().toString(36).toUpperCase()}`;
  const catId = categoryId !== undefined && categoryId !== null && categoryId !== '' ? parseInt(categoryId, 10) : null;
  try {
    let r;
    try {
      r = db.prepare(`INSERT INTO part_families (code, name, description, category_id, sub_family_1, sub_family_2, sub_family_3, sub_family_4, sub_family_5)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(code, name, description || null, catId, subFamily1 || null, subFamily2 || null, subFamily3 || null, subFamily4 || null, subFamily5 || null);
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        try {
          r = db.prepare('INSERT INTO part_families (code, name, description, category_id) VALUES (?, ?, ?, ?)').run(code, name, description || null, catId);
        } catch (e2) {
          if (e2.message && e2.message.includes('no such column'))
            r = db.prepare('INSERT INTO part_families (code, name, description) VALUES (?, ?, ?)').run(code, name, description || null);
          else throw e2;
        }
      } else throw e;
    }
    const row = db.prepare('SELECT * FROM part_families WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    throw e;
  }
});

router.put('/:id', requirePermission('part_families', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM part_families WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Famille non trouvée' });
  const { code, name, description, categoryId, subFamily1, subFamily2, subFamily3, subFamily4, subFamily5 } = req.body;
  const catId = categoryId !== undefined ? (categoryId === '' || categoryId === null ? null : parseInt(categoryId, 10)) : existing.category_id;
  const sub1 = subFamily1 !== undefined ? subFamily1 : existing.sub_family_1;
  const sub2 = subFamily2 !== undefined ? subFamily2 : existing.sub_family_2;
  const sub3 = subFamily3 !== undefined ? subFamily3 : existing.sub_family_3;
  const sub4 = subFamily4 !== undefined ? subFamily4 : existing.sub_family_4;
  const sub5 = subFamily5 !== undefined ? subFamily5 : existing.sub_family_5;
  try {
    const hasCategory = db.prepare("SELECT 1 FROM pragma_table_info('part_families') WHERE name = 'category_id'").get();
    if (hasCategory) {
      db.prepare(`UPDATE part_families SET code = ?, name = ?, description = ?, category_id = ?, sub_family_1 = ?, sub_family_2 = ?, sub_family_3 = ?, sub_family_4 = ?, sub_family_5 = ? WHERE id = ?`)
        .run(code ?? existing.code, name ?? existing.name, description !== undefined ? description : existing.description, catId, sub1 || null, sub2 || null, sub3 || null, sub4 || null, sub5 || null, id);
    } else {
      db.prepare(`UPDATE part_families SET code = ?, name = ?, description = ?, sub_family_1 = ?, sub_family_2 = ?, sub_family_3 = ?, sub_family_4 = ?, sub_family_5 = ? WHERE id = ?`)
        .run(code ?? existing.code, name ?? existing.name, description !== undefined ? description : existing.description, sub1 || null, sub2 || null, sub3 || null, sub4 || null, sub5 || null, id);
    }
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.prepare('UPDATE part_families SET code = ?, name = ?, description = ? WHERE id = ?')
        .run(code ?? existing.code, name ?? existing.name, description !== undefined ? description : existing.description, id);
    } else throw e;
  }
  const out = db.prepare('SELECT * FROM part_families WHERE id = ?').get(id);
  const pc = db.prepare("SELECT 1 FROM pragma_table_info('part_families') WHERE name = 'category_id'").get();
  if (pc) {
    const cat = out && out.category_id ? db.prepare('SELECT code as category_code, name as category_name FROM part_categories WHERE id = ?').get(out.category_id) : null;
    if (out) { out.category_code = cat?.category_code; out.category_name = cat?.category_name; }
  }
  res.json(out);
});

router.delete('/:id', requirePermission('part_families', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM part_families WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Famille non trouvée' });
  res.status(204).send();
});

module.exports = router;
