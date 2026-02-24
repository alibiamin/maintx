/**
 * API Réservations de pièces pour OT
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function enrichReservationRow(db, row) {
  if (!row) return row;
  const up = row.unit_price != null ? Number(row.unit_price) : 0;
  const qty = row.quantity || 0;
  const line_cost = Math.round(qty * up * 100) / 100;
  const out = { ...row, unit_price: up, line_cost };
  try {
    const ext = db.prepare(`
      SELECT pf.code as part_family_code, pf.name as part_family_name, sl.code as location_code, sl.name as location_name
      FROM spare_parts sp
      LEFT JOIN part_families pf ON sp.part_family_id = pf.id
      LEFT JOIN stock_locations sl ON sp.location_id = sl.id
      WHERE sp.id = ?
    `).get(row.spare_part_id);
    if (ext) Object.assign(out, ext);
  } catch (_) {}
  return out;
}

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const { workOrderId, sparePartId, status } = req.query;
    let sql = `
      SELECT sr.*, sp.code as part_code, sp.name as part_name, sp.unit_price,
             wo.number as wo_number, wo.title as wo_title,
             u.first_name || ' ' || u.last_name as reserved_by_name
      FROM stock_reservations sr
      JOIN spare_parts sp ON sr.spare_part_id = sp.id
      JOIN work_orders wo ON sr.work_order_id = wo.id
      LEFT JOIN users u ON sr.reserved_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (workOrderId) { sql += ' AND sr.work_order_id = ?'; params.push(workOrderId); }
    if (sparePartId) { sql += ' AND sr.spare_part_id = ?'; params.push(sparePartId); }
    if (status) { sql += ' AND sr.status = ?'; params.push(status); }
    sql += ' ORDER BY sr.reserved_at DESC';
    let rows = db.prepare(sql).all(...params);
    try {
      const withFamilyLoc = db.prepare(`
        SELECT sr.id, sr.spare_part_id, sr.work_order_id, sr.quantity, sr.status, sr.reserved_by, sr.reserved_at, sr.released_at,
               sp.code as part_code, sp.name as part_name, sp.unit_price,
               pf.code as part_family_code, pf.name as part_family_name, sl.code as location_code, sl.name as location_name
        FROM stock_reservations sr
        JOIN spare_parts sp ON sr.spare_part_id = sp.id
        LEFT JOIN part_families pf ON sp.part_family_id = pf.id
        LEFT JOIN stock_locations sl ON sp.location_id = sl.id
        WHERE sr.id = ?
      `);
      rows = rows.map((r) => {
        const ext = withFamilyLoc.get(r.id);
        if (!ext) return r;
        const up = ext.unit_price != null ? Number(ext.unit_price) : 0;
        const line_cost = (r.quantity || 0) * up;
        return { ...r, unit_price: up, line_cost: Math.round(line_cost * 100) / 100, part_family_code: ext.part_family_code, part_family_name: ext.part_family_name, location_code: ext.location_code, location_name: ext.location_name };
      });
    } catch (_) {
      rows = rows.map((r) => {
        const up = r.unit_price != null ? Number(r.unit_price) : 0;
        const line_cost = (r.quantity || 0) * up;
        return { ...r, line_cost: Math.round(line_cost * 100) / 100 };
      });
    }
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('workOrderId').isInt(),
  body('sparePartId').isInt(),
  body('quantity').isInt({ min: 1 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { workOrderId, sparePartId, quantity } = req.body;
  try {
    // Vérifier le stock disponible (aligné avec work_order_reservations)
    let available = 0;
    try {
      const bal = db.prepare('SELECT quantity_accepted, quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
      available = bal?.quantity_accepted ?? bal?.quantity ?? 0;
    } catch (_) {
      const bal = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
      available = bal?.quantity ?? 0;
    }
    let alreadyReserved = 0;
    try {
      const sum = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total FROM stock_reservations
        WHERE spare_part_id = ? AND status = 'reserved'
      `).get(sparePartId);
      alreadyReserved = sum?.total ?? 0;
    } catch (_) {}
    if (available < alreadyReserved + quantity) {
      return res.status(400).json({
        error: `Stock insuffisant. Disponible : ${available}, déjà réservé : ${alreadyReserved}, demandé : ${quantity}.`
      });
    }
    const r = db.prepare(`
      INSERT INTO stock_reservations (spare_part_id, work_order_id, quantity, status, reserved_by)
      VALUES (?, ?, ?, 'reserved', ?)
    `).run(sparePartId, workOrderId, quantity, req.user.id);
    const row = db.prepare(`
      SELECT sr.*, sp.code as part_code, sp.name as part_name, sp.unit_price, wo.number as wo_number, wo.title as wo_title
      FROM stock_reservations sr
      JOIN spare_parts sp ON sr.spare_part_id = sp.id
      JOIN work_orders wo ON sr.work_order_id = wo.id
      WHERE sr.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(enrichReservationRow(db, row));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table stock_reservations non disponible' });
    throw e;
  }
});

router.put('/:id/release', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM stock_reservations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Réservation non trouvée' });
  db.prepare("UPDATE stock_reservations SET status = 'released', released_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  const row = db.prepare(`
    SELECT sr.*, sp.code as part_code, sp.name as part_name, sp.unit_price, wo.number as wo_number
    FROM stock_reservations sr
    JOIN spare_parts sp ON sr.spare_part_id = sp.id
    JOIN work_orders wo ON sr.work_order_id = wo.id
    WHERE sr.id = ?
  `).get(id);
  res.json(enrichReservationRow(db, row));
});

router.put('/:id/consume', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM stock_reservations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Réservation non trouvée' });
  db.prepare("UPDATE stock_reservations SET status = 'consumed', released_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  const row = db.prepare(`
    SELECT sr.*, sp.code as part_code, sp.name as part_name, sp.unit_price, wo.number as wo_number
    FROM stock_reservations sr
    JOIN spare_parts sp ON sr.spare_part_id = sp.id
    JOIN work_orders wo ON sr.work_order_id = wo.id
    WHERE sr.id = ?
  `).get(id);
  res.json(enrichReservationRow(db, row));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM stock_reservations WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Réservation non trouvée' });
  res.status(204).send();
});

module.exports = router;
