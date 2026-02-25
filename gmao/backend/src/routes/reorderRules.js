/**
 * API Règles de réapprovisionnement
 * Seuils min/max par pièce et magasin ou site, délai, option commande auto.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, requirePermission, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function formatRule(row, db) {
  if (!row) return null;
  return {
    id: row.id,
    sparePartId: row.spare_part_id,
    warehouseId: row.warehouse_id,
    siteId: row.site_id,
    minQuantity: row.min_quantity,
    maxQuantity: row.max_quantity,
    leadTimeDays: row.lead_time_days,
    autoCreatePo: !!row.auto_create_po,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    partCode: row.part_code,
    partName: row.part_name,
    warehouseName: row.warehouse_name,
    siteName: row.site_name
  };
}

router.get('/', requirePermission('reorder_rules', 'view'), [
  query('sparePartId').optional().isInt(),
  query('warehouseId').optional().isInt(),
  query('siteId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reorder_rules'").get();
    if (!hasTable) return res.json([]);
    let sql = `
      SELECT rr.*, sp.code as part_code, sp.name as part_name,
             w.name as warehouse_name, s.name as site_name
      FROM reorder_rules rr
      LEFT JOIN spare_parts sp ON sp.id = rr.spare_part_id
      LEFT JOIN warehouses w ON w.id = rr.warehouse_id
      LEFT JOIN sites s ON s.id = rr.site_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.sparePartId) { sql += ' AND rr.spare_part_id = ?'; params.push(req.query.sparePartId); }
    if (req.query.warehouseId) { sql += ' AND rr.warehouse_id = ?'; params.push(req.query.warehouseId); }
    if (req.query.siteId) { sql += ' AND rr.site_id = ?'; params.push(req.query.siteId); }
    sql += ' ORDER BY sp.code';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatRule(r, db)));
  } catch (e) {
    console.error('[reorderRules] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('reorder_rules', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT rr.*, sp.code as part_code, sp.name as part_name,
             w.name as warehouse_name, s.name as site_name
      FROM reorder_rules rr
      LEFT JOIN spare_parts sp ON sp.id = rr.spare_part_id
      LEFT JOIN warehouses w ON w.id = rr.warehouse_id
      LEFT JOIN sites s ON s.id = rr.site_id
      WHERE rr.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Règle non trouvée.' });
    res.json(formatRule(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('reorder_rules', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('sparePartId').isInt(),
  body('minQuantity').isFloat({ min: 0 }),
  body('maxQuantity').isFloat({ min: 0 }),
  body('warehouseId').optional().isInt(),
  body('siteId').optional().isInt(),
  body('leadTimeDays').optional().isInt({ min: 0 }),
  body('autoCreatePo').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reorder_rules'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table reorder_rules absente.' });
    const { sparePartId, warehouseId, siteId, minQuantity, maxQuantity, leadTimeDays, autoCreatePo } = req.body;
    if (!warehouseId && !siteId) return res.status(400).json({ error: 'Indiquer un magasin ou un site.' });
    db.prepare(`
      INSERT INTO reorder_rules (spare_part_id, warehouse_id, site_id, min_quantity, max_quantity, lead_time_days, auto_create_po)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sparePartId, warehouseId || null, siteId || null, minQuantity, maxQuantity, leadTimeDays || 0, autoCreatePo ? 1 : 0);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    const row = db.prepare(`
      SELECT rr.*, sp.code as part_code, sp.name as part_name, w.name as warehouse_name, s.name as site_name
      FROM reorder_rules rr
      LEFT JOIN spare_parts sp ON sp.id = rr.spare_part_id
      LEFT JOIN warehouses w ON w.id = rr.warehouse_id
      LEFT JOIN sites s ON s.id = rr.site_id
      WHERE rr.id = ?
    `).get(id);
    res.status(201).json(formatRule(row, db));
  } catch (e) {
    console.error('[reorderRules] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('reorder_rules', 'update'), param('id').isInt(), [
  body('minQuantity').optional().isFloat({ min: 0 }),
  body('maxQuantity').optional().isFloat({ min: 0 }),
  body('leadTimeDays').optional().isInt({ min: 0 }),
  body('autoCreatePo').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id FROM reorder_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Règle non trouvée.' });
    const updates = [];
    const params = [];
    const map = { minQuantity: 'min_quantity', maxQuantity: 'max_quantity', leadTimeDays: 'lead_time_days', autoCreatePo: 'auto_create_po' };
    for (const [k, v] of Object.entries(req.body)) {
      const col = map[k];
      if (col && v !== undefined) { updates.push(`${col} = ?`); params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v); }
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE reorder_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    const row = db.prepare(`
      SELECT rr.*, sp.code as part_code, sp.name as part_name, w.name as warehouse_name, s.name as site_name
      FROM reorder_rules rr
      LEFT JOIN spare_parts sp ON sp.id = rr.spare_part_id
      LEFT JOIN warehouses w ON w.id = rr.warehouse_id
      LEFT JOIN sites s ON s.id = rr.site_id
      WHERE rr.id = ?
    `).get(req.params.id);
    res.json(formatRule(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('reorder_rules', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const r = db.prepare('DELETE FROM reorder_rules WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Règle non trouvée.' });
    res.json({ message: 'Règle supprimée.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
