/**
 * API Magasins / Entrepôts
 * Multi-magasins type Coswin : entités de stock distinctes.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, requirePermission, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatWarehouse(row, db) {
  if (!row) return null;
  let locationCount = 0;
  try {
    const r = db.prepare('SELECT COUNT(*) as c FROM stock_locations WHERE warehouse_id = ?').get(row.id);
    locationCount = r?.c ?? 0;
  } catch (_) {}
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    siteId: row.site_id,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    siteName: row.site_name,
    locationCount
  };
}

router.get('/', requirePermission('warehouses', 'view'), (req, res) => {
  const db = req.db;
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='warehouses'").get();
    if (!hasTable) return res.json([]);
    const rows = db.prepare(`
      SELECT w.*, s.name as site_name
      FROM warehouses w
      LEFT JOIN sites s ON s.id = w.site_id
      ORDER BY w.code
    `).all();
    res.json(rows.map(r => formatWarehouse(r, db)));
  } catch (e) {
    console.error('[warehouses] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('warehouses', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT w.*, s.name as site_name
      FROM warehouses w
      LEFT JOIN sites s ON s.id = w.site_id
      WHERE w.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Magasin non trouvé.' });
    const locations = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='stock_locations'").get()
      ? db.prepare('SELECT id, code, name FROM stock_locations WHERE warehouse_id = ?').all(req.params.id)
      : [];
    const out = formatWarehouse(row, db);
    out.locations = locations;
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('warehouses', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('code').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  body('siteId').optional().isInt(),
  body('isDefault').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='warehouses'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table warehouses absente.' });
    const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(req.body.code);
    if (existing) return res.status(400).json({ error: 'Code magasin déjà utilisé.' });
    const { code, name, description, siteId, isDefault } = req.body;
    if (isDefault) {
      db.prepare('UPDATE warehouses SET is_default = 0').run();
    }
    db.prepare(`
      INSERT INTO warehouses (code, name, description, site_id, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, name, description || null, siteId || null, isDefault ? 1 : 0);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    const row = db.prepare('SELECT w.*, s.name as site_name FROM warehouses w LEFT JOIN sites s ON s.id = w.site_id WHERE w.id = ?').get(id);
    res.status(201).json(formatWarehouse(row, db));
  } catch (e) {
    console.error('[warehouses] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('warehouses', 'update'), param('id').isInt(), [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('siteId').optional().isInt(),
  body('isDefault').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Magasin non trouvé.' });
    if (req.body.isDefault === true) {
      db.prepare('UPDATE warehouses SET is_default = 0').run();
    }
    const updates = [];
    const params = [];
    if (req.body.name !== undefined) { updates.push('name = ?'); params.push(req.body.name); }
    if (req.body.description !== undefined) { updates.push('description = ?'); params.push(req.body.description); }
    if (req.body.siteId !== undefined) { updates.push('site_id = ?'); params.push(req.body.siteId || null); }
    if (req.body.isDefault !== undefined) { updates.push('is_default = ?'); params.push(req.body.isDefault ? 1 : 0); }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE warehouses SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    const row = db.prepare('SELECT w.*, s.name as site_name FROM warehouses w LEFT JOIN sites s ON s.id = w.site_id WHERE w.id = ?').get(req.params.id);
    res.json(formatWarehouse(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('warehouses', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const used = db.prepare('SELECT COUNT(*) as c FROM stock_locations WHERE warehouse_id = ?').get(req.params.id)?.c ?? 0;
    if (used > 0) return res.status(400).json({ error: 'Impossible de supprimer un magasin ayant des emplacements.' });
    const r = db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Magasin non trouvé.' });
    res.json({ message: 'Magasin supprimé.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
