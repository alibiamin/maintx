/**
 * API Gestion des stocks - Pièces de rechange, mouvements, alertes
 * Statuts : A = Accepté (utilisable OT/projets), Q = Quarantaine, R = Rejeté
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

const STOCK_STATUS = { A: 'A', Q: 'Q', R: 'R' };

function hasStatusColumns(db) {
  try {
    db.prepare('SELECT quantity_accepted FROM stock_balance LIMIT 1').get();
    return true;
  } catch (_) { return false; }
}

function hasMovementStatusColumn(db) {
  try {
    db.prepare('SELECT status FROM stock_movements LIMIT 1').get();
    return true;
  } catch (_) { return false; }
}

/** Joins et colonnes optionnels : familles de pièces + emplacements stock (migration 039) */
function getFamilyLocationJoin(db) {
  try {
    db.prepare('SELECT part_family_id, location_id FROM spare_parts LIMIT 1').get();
    return {
      join: ' LEFT JOIN part_families pf ON sp.part_family_id = pf.id LEFT JOIN stock_locations sl ON sp.location_id = sl.id',
      select: ', pf.code as part_family_code, pf.name as part_family_name, sl.code as location_code, sl.name as location_name'
    };
  } catch (_) { return { join: '', select: '' }; }
}

function getBalance(db, sparePartId) {
  const row = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const qty = row?.quantity ?? 0;
  if (!hasStatusColumns(db)) return { quantity: qty, quantity_accepted: qty, quantity_quarantine: 0, quantity_rejected: 0 };
  const r = db.prepare('SELECT quantity_accepted, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  return {
    quantity: qty,
    quantity_accepted: r?.quantity_accepted ?? qty,
    quantity_quarantine: r?.quantity_quarantine ?? 0,
    quantity_rejected: r?.quantity_rejected ?? 0
  };
}

function updateBalance(db, sparePartId, quantityDelta) {
  const current = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const newQty = Math.max(0, (current?.quantity || 0) + quantityDelta);
  if (hasStatusColumns(db)) {
    const r = db.prepare('SELECT quantity_accepted, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
    const acc = (r?.quantity_accepted ?? current?.quantity ?? 0) + quantityDelta;
    db.prepare(`
      INSERT INTO stock_balance (spare_part_id, quantity, quantity_accepted, quantity_quarantine, quantity_rejected, updated_at)
      VALUES (?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(spare_part_id) DO UPDATE SET quantity = excluded.quantity, quantity_accepted = excluded.quantity_accepted, updated_at = CURRENT_TIMESTAMP
    `).run(sparePartId, newQty, Math.max(0, acc));
    return;
  }
  db.prepare(`
    INSERT INTO stock_balance (spare_part_id, quantity, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(spare_part_id) DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP
  `).run(sparePartId, newQty);
}

function addStockIn(db, sparePartId, quantity, status) {
  const s = status === STOCK_STATUS.Q ? STOCK_STATUS.Q : STOCK_STATUS.A;
  if (!hasStatusColumns(db)) {
    updateBalance(db, sparePartId, quantity);
    return;
  }
  const row = db.prepare('SELECT quantity, quantity_accepted, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const cur = row || { quantity: 0, quantity_accepted: 0, quantity_quarantine: 0, quantity_rejected: 0 };
  let newAcc = cur.quantity_accepted, newQuar = cur.quantity_quarantine;
  if (s === STOCK_STATUS.A) newAcc += quantity; else newQuar += quantity;
  const newQty = cur.quantity + quantity;
  db.prepare(`
    INSERT INTO stock_balance (spare_part_id, quantity, quantity_accepted, quantity_quarantine, quantity_rejected, updated_at)
    VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(spare_part_id) DO UPDATE SET quantity = excluded.quantity, quantity_accepted = excluded.quantity_accepted, quantity_quarantine = excluded.quantity_quarantine, updated_at = CURRENT_TIMESTAMP
  `).run(sparePartId, newQty, newAcc, newQuar);
}

function deductStockOut(db, sparePartId, quantity) {
  if (!hasStatusColumns(db)) {
    updateBalance(db, sparePartId, -quantity);
    return;
  }
  const row = db.prepare('SELECT quantity, quantity_accepted FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const acc = row?.quantity_accepted ?? row?.quantity ?? 0;
  if (acc < quantity) throw new Error('Stock accepté insuffisant. Seul le stock au statut Accepté (A) peut être utilisé pour les OT et projets.');
  const newQty = Math.max(0, (row?.quantity ?? 0) - quantity);
  const newAcc = Math.max(0, acc - quantity);
  db.prepare(`
    UPDATE stock_balance SET quantity = ?, quantity_accepted = ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
  `).run(newQty, newAcc, sparePartId);
}

function releaseQuarantine(db, sparePartId, quantity) {
  const row = db.prepare('SELECT quantity_quarantine, quantity_accepted FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const quar = row?.quantity_quarantine ?? 0;
  if (quar < quantity) throw new Error('Quantité en quarantaine insuffisante');
  db.prepare(`
    UPDATE stock_balance SET quantity_quarantine = quantity_quarantine - ?, quantity_accepted = quantity_accepted + ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
  `).run(quantity, quantity, sparePartId);
}

function rejectQuarantine(db, sparePartId, quantity) {
  const row = db.prepare('SELECT quantity, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const quar = row?.quantity_quarantine ?? 0;
  if (quar < quantity) throw new Error('Quantité en quarantaine insuffisante');
  const newQty = Math.max(0, (row?.quantity ?? 0) - quantity);
  const newQuar = quar - quantity;
  const newRej = (row?.quantity_rejected ?? 0) + quantity;
  db.prepare(`
    UPDATE stock_balance SET quantity = ?, quantity_quarantine = ?, quantity_rejected = ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
  `).run(newQty, newQuar, newRej, sparePartId);
}

/**
 * Change le statut d'une quantité de stock (total ou partiel). fromStatus/toStatus in ['A','Q','R'].
 * A↔Q : pas de changement de quantité physique. A→R / Q→R : diminution physique. R→A / R→Q : augmentation physique.
 */
function changeStatus(db, sparePartId, fromStatus, toStatus, quantity) {
  if (fromStatus === toStatus) throw new Error('Statut source et cible identiques');
  const row = db.prepare('SELECT quantity, quantity_accepted, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
  const cur = row || { quantity: 0, quantity_accepted: 0, quantity_quarantine: 0, quantity_rejected: 0 };
  const acc = cur.quantity_accepted ?? 0;
  const quar = cur.quantity_quarantine ?? 0;
  const rej = cur.quantity_rejected ?? 0;
  const total = cur.quantity ?? 0;
  let newQty = total;
  let newAcc = acc;
  let newQuar = quar;
  let newRej = rej;

  const check = (available, label) => { if (available < quantity) throw new Error(`${label} insuffisant (disponible: ${available})`); };

  if (fromStatus === STOCK_STATUS.A) {
    check(acc, 'Stock accepté');
    newAcc = acc - quantity;
    if (toStatus === STOCK_STATUS.Q) {
      newQuar = quar + quantity;
    } else {
      newQty = total - quantity;
      newRej = rej + quantity;
    }
  } else if (fromStatus === STOCK_STATUS.Q) {
    check(quar, 'Stock en quarantaine');
    newQuar = quar - quantity;
    if (toStatus === STOCK_STATUS.A) {
      newAcc = acc + quantity;
    } else {
      newQty = total - quantity;
      newRej = rej + quantity;
    }
  } else if (fromStatus === STOCK_STATUS.R) {
    check(rej, 'Stock rejeté');
    newRej = rej - quantity;
    if (toStatus === STOCK_STATUS.A) {
      newAcc = acc + quantity;
      newQty = total + quantity;
    } else {
      newQuar = quar + quantity;
      newQty = total + quantity;
    }
  } else {
    throw new Error('Statut source invalide');
  }

  if (newAcc < 0 || newQuar < 0 || newRej < 0 || newQty < 0) throw new Error('Quantité invalide après changement');
  db.prepare(`
    UPDATE stock_balance SET quantity = ?, quantity_accepted = ?, quantity_quarantine = ?, quantity_rejected = ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
  `).run(newQty, newAcc, newQuar, newRej, sparePartId);
}

/**
 * GET /api/stock/parts
 * Query: belowMin, search, page (1-based), limit (default 20)
 * If page/limit provided: Response { data: [...], total: N }. Otherwise: array.
 */
router.get('/parts', requirePermission('stock', 'view'), (req, res) => {
  const db = req.db;
  const fl = getFamilyLocationJoin(db);
  const { belowMin, search, page, limit } = req.query;
  const usePagination = page !== undefined && page !== '';
  const limitNum = usePagination ? Math.min(parseInt(limit, 10) || 20, 100) : 1e6;
  const offset = usePagination ? ((parseInt(page, 10) || 1) - 1) * limitNum : 0;
  let where = `
    FROM spare_parts sp
    LEFT JOIN suppliers s ON sp.supplier_id = s.id
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    ${fl.join}
    WHERE 1=1
  `;
  const params = [];
  if (belowMin === 'true') where += ' AND COALESCE(sb.quantity, 0) <= sp.min_stock';
  if (search) { where += ' AND (sp.code LIKE ? OR sp.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  let total = 0;
  if (usePagination) {
    const countRow = db.prepare(`SELECT COUNT(*) as total ${where}`).get(...params);
    total = countRow?.total ?? 0;
  }
  const sortBy = req.query.sortBy === 'name' ? 'sp.name' : 'sp.code';
  const order = (req.query.order || 'asc') === 'asc' ? 'ASC' : 'DESC';
  const joinUnits = ' LEFT JOIN units u ON sp.unit_id = u.id';
  const unitSelect = ', u.name as unit_name';
  let whereWithUnits = where.replace('FROM spare_parts sp', 'FROM spare_parts sp' + joinUnits);
  let sql = `
    SELECT sp.*, s.name as supplier_name${unitSelect || ''}${fl.select || ''}, COALESCE(sb.quantity, 0) as stock_quantity,
           CASE WHEN COALESCE(sb.quantity, 0) <= sp.min_stock THEN 1 ELSE 0 END as below_minimum
    ${whereWithUnits}
    ORDER BY below_minimum DESC, ${sortBy} ${order} LIMIT ? OFFSET ?
  `;
  if (hasStatusColumns(db)) {
    sql = `
      SELECT sp.*, s.name as supplier_name${unitSelect || ''}${fl.select || ''}, COALESCE(sb.quantity, 0) as stock_quantity,
             COALESCE(sb.quantity_accepted, sb.quantity) as quantity_accepted,
             COALESCE(sb.quantity_quarantine, 0) as quantity_quarantine,
             COALESCE(sb.quantity_rejected, 0) as quantity_rejected,
             CASE WHEN COALESCE(sb.quantity, 0) <= sp.min_stock THEN 1 ELSE 0 END as below_minimum
      ${whereWithUnits}
      ORDER BY below_minimum DESC, ${sortBy} ${order} LIMIT ? OFFSET ?
    `;
  }
  let rows;
  try {
    rows = db.prepare(sql).all(...params, limitNum, offset);
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      let fallbackWhere = `
    FROM spare_parts sp
    LEFT JOIN suppliers s ON sp.supplier_id = s.id
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE 1=1
  `;
      if (belowMin === 'true') fallbackWhere += ' AND COALESCE(sb.quantity, 0) <= sp.min_stock';
      if (search) { fallbackWhere += ' AND (sp.code LIKE ? OR sp.name LIKE ?)'; }
      const fallbackParams = search ? [...params] : [];
      sql = `
        SELECT sp.*, s.name as supplier_name, COALESCE(sb.quantity, 0) as stock_quantity,
               CASE WHEN COALESCE(sb.quantity, 0) <= sp.min_stock THEN 1 ELSE 0 END as below_minimum
        ${fallbackWhere}
        ORDER BY below_minimum DESC, ${sortBy} ${order} LIMIT ? OFFSET ?
      `;
      if (hasStatusColumns(db)) {
        sql = `
          SELECT sp.*, s.name as supplier_name, COALESCE(sb.quantity, 0) as stock_quantity,
                 COALESCE(sb.quantity_accepted, sb.quantity) as quantity_accepted,
                 COALESCE(sb.quantity_quarantine, 0) as quantity_quarantine,
                 COALESCE(sb.quantity_rejected, 0) as quantity_rejected,
                 CASE WHEN COALESCE(sb.quantity, 0) <= sp.min_stock THEN 1 ELSE 0 END as below_minimum
          ${fallbackWhere}
          ORDER BY below_minimum DESC, ${sortBy} ${order} LIMIT ? OFFSET ?
        `;
      }
      rows = db.prepare(sql).all(...fallbackParams, limitNum, offset);
    } else throw e;
  }
  const byId = new Map();
  rows.forEach((r) => {
    if (!byId.has(r.id)) {
      if (r.quantity_accepted === undefined) { r.quantity_accepted = r.stock_quantity ?? 0; r.quantity_quarantine = 0; r.quantity_rejected = 0; }
      byId.set(r.id, r);
    }
  });
  const data = [...byId.values()];
  if (usePagination) res.json({ data, total });
  else res.json(data);
});

/**
 * GET /api/stock/movements - doit être avant /parts/:id
 * Query: work_order_id (optionnel) pour filtrer par OT
 */
router.get('/movements', (req, res) => {
  const db = req.db;
  try {
    const { work_order_id } = req.query;
    let sql = `
      SELECT sm.*, sp.name as part_name, sp.code as part_code, sp.unit_price,
             u.first_name || ' ' || u.last_name as user_name,
             wo.number as work_order_number
      FROM stock_movements sm
      LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN work_orders wo ON sm.work_order_id = wo.id
      WHERE 1=1
    `;
    const params = [];
    if (work_order_id) {
      sql += ' AND sm.work_order_id = ?';
      params.push(parseInt(work_order_id, 10));
    }
    sql += ' ORDER BY sm.created_at DESC LIMIT 200';
    let rows;
    try {
      rows = db.prepare(sql).all(...params);
    } catch (err) {
      if (err.message && err.message.includes('no such column')) {
        sql = `
          SELECT sm.*, sp.name as part_name, sp.code as part_code,
                 u.first_name || ' ' || u.last_name as user_name,
                 wo.number as work_order_number
          FROM stock_movements sm
          LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
          LEFT JOIN users u ON sm.user_id = u.id
          LEFT JOIN work_orders wo ON sm.work_order_id = wo.id
          WHERE 1=1
        ` + (work_order_id ? ' AND sm.work_order_id = ?' : '') + ' ORDER BY sm.created_at DESC LIMIT 200';
        rows = db.prepare(sql).all(...(work_order_id ? [...params] : []));
      } else throw err;
    }
    res.json(rows.map(r => {
      const up = r.unit_price != null ? Number(r.unit_price) : 0;
      const qty = Math.abs(Number(r.quantity) || 0);
      const line_cost = Math.round(qty * up * 100) / 100;
      return { ...r, partName: r.part_name, userName: r.user_name, workOrderNumber: r.work_order_number, unit_price: up, line_cost };
    }));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.get('/entries', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT sm.*, sp.name as part_name, s.name as supplier_name,
             u.first_name || ' ' || u.last_name as user_name
      FROM stock_movements sm
      LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.movement_type = 'in' AND sm.quantity > 0
      ORDER BY sm.created_at DESC
      LIMIT 200
    `).all();
    res.json(rows.map(r => ({
      ...r,
      partName: r.part_name,
      supplierName: r.supplier_name,
      userName: r.user_name,
      date: r.created_at,
      quantity: r.quantity,
      reference: r.reference
    })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.get('/exits', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT sm.*, sp.name as part_name,
             u.first_name || ' ' || u.last_name as user_name,
             wo.number as work_order_number
      FROM stock_movements sm
      LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN work_orders wo ON sm.work_order_id = wo.id
      WHERE sm.movement_type = 'out'
      ORDER BY sm.created_at DESC
      LIMIT 200
    `).all();
    res.json(rows.map(r => ({
      ...r,
      partName: r.part_name,
      userName: r.user_name,
      date: r.created_at,
      quantity: Math.abs(r.quantity),
      reference: r.reference,
      workOrderNumber: r.work_order_number
    })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.get('/transfers', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT sm.*, sp.name as part_name,
             u.first_name || ' ' || u.last_name as user_name
      FROM stock_movements sm
      LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.movement_type = 'transfer'
      ORDER BY sm.created_at DESC
      LIMIT 200
    `).all();
    res.json(rows.map(r => ({
      ...r,
      partName: r.part_name,
      userName: r.user_name,
      date: r.created_at,
      quantity: r.quantity,
      reference: r.reference
    })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Inventaires physiques
 */
function getInventoriesTable(db) {
  try {
    db.prepare('SELECT 1 FROM stock_inventories LIMIT 1').get();
    return true;
  } catch (_) { return false; }
}

router.get('/inventories', (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.json([]);
  try {
    const rows = db.prepare(`
      SELECT si.*, u.first_name || ' ' || u.last_name as responsible_name,
             (SELECT COUNT(*) FROM stock_inventory_lines WHERE inventory_id = si.id) as items_count,
             (SELECT COUNT(*) FROM stock_inventory_lines WHERE inventory_id = si.id AND COALESCE(variance, 0) != 0) as discrepancies
      FROM stock_inventories si
      LEFT JOIN users u ON si.responsible_id = u.id
      ORDER BY si.inventory_date DESC, si.id DESC
      LIMIT 100
    `).all();
    res.json(rows);
  } catch (_) { res.json([]); }
});

router.get('/inventories/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.status(404).json({ error: 'Non disponible' });
  const inv = db.prepare(`
    SELECT si.*, u.first_name || ' ' || u.last_name as responsible_name
    FROM stock_inventories si
    LEFT JOIN users u ON si.responsible_id = u.id
    WHERE si.id = ?
  `).get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Inventaire non trouvé' });
  const lines = db.prepare(`
    SELECT sil.*, sp.code as part_code, sp.name as part_name
    FROM stock_inventory_lines sil
    JOIN spare_parts sp ON sil.spare_part_id = sp.id
    WHERE sil.inventory_id = ?
    ORDER BY sp.code
  `).all(req.params.id);
  res.json({ ...inv, lines });
});

router.post('/inventories', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('inventory_date').notEmpty(),
  body('reference').optional().trim()
], (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.status(400).json({ error: 'Table inventaires non disponible' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const ref = req.body.reference || `INV-${Date.now()}`;
  try {
    db.prepare(`
      INSERT INTO stock_inventories (reference, inventory_date, responsible_id, status, notes)
      VALUES (?, ?, ?, 'draft', ?)
    `).run(ref, req.body.inventory_date, req.user?.id || null, req.body.notes || null);
    const row = db.prepare('SELECT * FROM stock_inventories ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Référence déjà existante' });
    throw e;
  }
});

router.put('/inventories/:id', param('id').isInt(), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.status(400).json({ error: 'Non disponible' });
  const { status, notes } = req.body;
  const id = parseInt(req.params.id, 10);
  const inv = db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Inventaire non trouvé' });
  if (inv.status === 'completed') return res.status(400).json({ error: 'Inventaire déjà clôturé' });
  if (status === 'completed') return res.status(400).json({ error: 'Utiliser POST /inventories/:id/complete pour clôturer' });
  const updates = []; const vals = [];
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (notes !== undefined) { updates.push('notes = ?'); vals.push(notes); }
  if (updates.length) { vals.push(id); db.prepare('UPDATE stock_inventories SET ' + updates.join(', ') + ', updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...vals); }
  const row = db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(id);
  res.json(row);
});

router.post('/inventories/:id/lines', param('id').isInt(), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('spare_part_id').isInt(),
  body('quantity_counted').isInt({ min: 0 })
], (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.status(400).json({ error: 'Non disponible' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const inventoryId = parseInt(req.params.id, 10);
  const inv = db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(inventoryId);
  if (!inv || inv.status === 'completed') return res.status(400).json({ error: 'Inventaire non modifiable' });
  const { spare_part_id, quantity_counted, notes } = req.body;
  const balance = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(spare_part_id);
  const quantity_system = balance ? balance.quantity : 0;
  const variance = quantity_counted - quantity_system;
  try {
    db.prepare(`
      INSERT INTO stock_inventory_lines (inventory_id, spare_part_id, quantity_system, quantity_counted, variance, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(inventory_id, spare_part_id) DO UPDATE SET quantity_counted = excluded.quantity_counted, variance = excluded.quantity_counted - quantity_system, notes = excluded.notes
    `).run(inventoryId, spare_part_id, quantity_system, quantity_counted, variance, notes || null);
  } catch (_) {
    db.prepare(`
      INSERT INTO stock_inventory_lines (inventory_id, spare_part_id, quantity_system, quantity_counted, variance, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(inventoryId, spare_part_id, quantity_system, quantity_counted, variance, notes || null);
  }
  const line = db.prepare('SELECT * FROM stock_inventory_lines WHERE inventory_id = ? AND spare_part_id = ?').get(inventoryId, spare_part_id);
  res.status(201).json(line);
});

router.post('/inventories/:id/complete', param('id').isInt(), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), (req, res) => {
  const db = req.db;
  if (!getInventoriesTable(db)) return res.status(400).json({ error: 'Non disponible' });
  const id = parseInt(req.params.id, 10);
  const inv = db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(id);
  if (!inv || inv.status === 'completed') return res.status(400).json({ error: 'Inventaire déjà clôturé ou inexistant' });
  const lines = db.prepare('SELECT * FROM stock_inventory_lines WHERE inventory_id = ?').all(id);
  for (const line of lines) {
    if (line.variance === 0) continue;
    const delta = line.variance;
    db.prepare(`
      INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes)
      VALUES (?, ?, 'adjustment', ?, ?, ?)
    `).run(line.spare_part_id, delta, inv.reference, req.user?.id || null, 'Ajustement inventaire ' + inv.reference);
    updateBalance(db, line.spare_part_id, delta);
  }
  db.prepare('UPDATE stock_inventories SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('completed', id);
  const row = db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(id);
  res.json(row);
});

/**
 * Demandes de réapprovisionnement
 */
function getReordersTable(db) {
  try {
    db.prepare('SELECT 1 FROM reorder_requests LIMIT 1').get();
    return true;
  } catch (_) { return false; }
}

router.get('/reorders', (req, res) => {
  const db = req.db;
  if (!getReordersTable(db)) return res.json([]);
  try {
    const rows = db.prepare(`
      SELECT rr.*, sp.code as part_code, sp.name as part_name, sp.min_stock,
             COALESCE(sb.quantity, 0) as stock_quantity,
             s.name as supplier_name,
             u.first_name || ' ' || u.last_name as requested_by_name
      FROM reorder_requests rr
      JOIN spare_parts sp ON rr.spare_part_id = sp.id
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      LEFT JOIN users u ON rr.requested_by = u.id
      ORDER BY rr.created_at DESC
      LIMIT 100
    `).all();
    res.json(rows);
  } catch (_) { res.json([]); }
});

router.post('/reorders', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('spare_part_id').isInt(),
  body('quantity_requested').isInt({ min: 1 })
], (req, res) => {
  const db = req.db;
  if (!getReordersTable(db)) return res.status(400).json({ error: 'Table réappro non disponible' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { spare_part_id, quantity_requested, notes } = req.body;
  const ref = `REQ-${Date.now()}-${spare_part_id}`;
  db.prepare(`
    INSERT INTO reorder_requests (reference, spare_part_id, quantity_requested, requested_by, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(ref, spare_part_id, quantity_requested, req.user?.id || null, notes || null);
  const row = db.prepare('SELECT * FROM reorder_requests ORDER BY id DESC LIMIT 1').get();
  res.status(201).json(row);
});

router.put('/reorders/:id', param('id').isInt(), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  if (!getReordersTable(db)) return res.status(400).json({ error: 'Non disponible' });
  const { status, supplier_order_id, quantity_ordered } = req.body;
  const id = parseInt(req.params.id, 10);
  const updates = []; const vals = [];
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (supplier_order_id !== undefined) { updates.push('supplier_order_id = ?'); vals.push(supplier_order_id); }
  if (quantity_ordered !== undefined) { updates.push('quantity_ordered = ?'); vals.push(quantity_ordered); }
  if (updates.length) { vals.push(id); db.prepare('UPDATE reorder_requests SET ' + updates.join(', ') + ', updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...vals); }
  const row = db.prepare('SELECT * FROM reorder_requests WHERE id = ?').get(id);
  res.json(row);
});

/**
 * GET /api/stock/parts/:id
 * Fiche stock complète (détails, image, stock actuel).
 */
router.get('/parts/:id', requirePermission('stock', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const fl = getFamilyLocationJoin(db);
  let row;
  try {
    row = db.prepare(`
      SELECT sp.*, s.name as supplier_name, u.name as unit_name${fl.select || ''}, COALESCE(sb.quantity, 0) as stock_quantity
      FROM spare_parts sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN units u ON sp.unit_id = u.id
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      ${fl.join}
      WHERE sp.id = ?
    `).get(req.params.id);
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('no such table'))) {
      try {
        row = db.prepare(`
          SELECT sp.*, s.name as supplier_name, COALESCE(sb.quantity, 0) as stock_quantity
          FROM spare_parts sp
          LEFT JOIN suppliers s ON sp.supplier_id = s.id
          LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
          WHERE sp.id = ?
        `).get(req.params.id);
      } catch (e2) {
        if (e2.message && e2.message.includes('no such column')) {
          row = db.prepare(`
            SELECT sp.id, sp.code, sp.name, sp.description, sp.unit, sp.unit_price, sp.min_stock, sp.supplier_id, sp.created_at, sp.updated_at,
                   s.name as supplier_name, COALESCE(sb.quantity, 0) as stock_quantity
            FROM spare_parts sp
            LEFT JOIN suppliers s ON sp.supplier_id = s.id
            LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
            WHERE sp.id = ?
          `).get(req.params.id);
          if (row) {
            row.image_data = null;
            row.location = null;
            row.manufacturer_reference = null;
          }
        } else throw e2;
      }
      if (row && !row.unit_name) row.unit_name = row.unit || null;
      if (row && !row.part_family_code) { row.part_family_code = null; row.part_family_name = null; row.location_code = null; row.location_name = null; }
    } else throw e;
  }
  if (!row) return res.status(404).json({ error: 'Pièce non trouvée' });
  if (hasStatusColumns(db)) {
    const bal = db.prepare('SELECT quantity_accepted, quantity_quarantine, quantity_rejected FROM stock_balance WHERE spare_part_id = ?').get(req.params.id);
    row.quantity_accepted = bal?.quantity_accepted ?? row.stock_quantity ?? 0;
    row.quantity_quarantine = bal?.quantity_quarantine ?? 0;
    row.quantity_rejected = bal?.quantity_rejected ?? 0;
  } else {
    row.quantity_accepted = row.stock_quantity ?? 0;
    row.quantity_quarantine = 0;
    row.quantity_rejected = 0;
  }
  res.json(row);
});

/**
 * PUT /api/stock/parts/:id
 * Mise à jour de la fiche stock (détails, image, etc.).
 */
router.put('/parts/:id', requirePermission('stock', 'update'), param('id').isInt(), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').optional().trim(),
  body('description').optional().trim(),
  body('unit').optional().trim(),
  body('unitId').optional({ nullable: true }).isInt(),
  body('unitPrice').optional().isFloat({ min: 0 }),
  body('minStock').optional().isInt({ min: 0 }),
  body('supplierId').optional({ nullable: true }).isInt(),
  body('location').optional().trim(),
  body('manufacturerReference').optional().trim(),
  body('imageData').optional(),
  body('stockCategory').optional().trim(),
  body('family').optional().trim(),
  body('subFamily1').optional().trim(),
  body('subFamily2').optional().trim(),
  body('subFamily3').optional().trim(),
  body('subFamily4').optional().trim(),
  body('subFamily5').optional().trim(),
  body('partFamilyId').optional({ nullable: true }).isInt(),
  body('locationId').optional({ nullable: true }).isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id FROM spare_parts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Pièce non trouvée' });
  const {
    name, description, unit, unitId, unitPrice, minStock, supplierId,
    location, manufacturerReference, imageData,
    stockCategory, family, subFamily1, subFamily2, subFamily3, subFamily4, subFamily5,
    partFamilyId, locationId
  } = req.body;
  let unitVal = unit;
  if (unitId !== undefined && unitId !== null) {
    try {
      const u = db.prepare('SELECT name FROM units WHERE id = ?').get(unitId);
      unitVal = u ? u.name : (unit || 'unit');
    } catch (_) { unitVal = unit || 'unit'; }
  }
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
  if (unitId !== undefined) {
    updates.push('unit_id = ?'); values.push(unitId || null);
    updates.push('unit = ?'); values.push(unitVal || 'unit');
  } else if (unit !== undefined) {
    updates.push('unit = ?'); values.push(unit || 'unit');
  }
  if (unitPrice !== undefined) { updates.push('unit_price = ?'); values.push(unitPrice); }
  if (minStock !== undefined) { updates.push('min_stock = ?'); values.push(minStock); }
  if (supplierId !== undefined) { updates.push('supplier_id = ?'); values.push(supplierId || null); }
  if (location !== undefined) { updates.push('location = ?'); values.push(location || null); }
  if (manufacturerReference !== undefined) { updates.push('manufacturer_reference = ?'); values.push(manufacturerReference || null); }
  if (imageData !== undefined) { updates.push('image_data = ?'); values.push(imageData && String(imageData).trim() ? String(imageData).trim() : null); }
  if (stockCategory !== undefined) { updates.push('stock_category = ?'); values.push(stockCategory || null); }
  if (family !== undefined) { updates.push('family = ?'); values.push(family || null); }
  if (subFamily1 !== undefined) { updates.push('sub_family_1 = ?'); values.push(subFamily1 || null); }
  if (subFamily2 !== undefined) { updates.push('sub_family_2 = ?'); values.push(subFamily2 || null); }
  if (subFamily3 !== undefined) { updates.push('sub_family_3 = ?'); values.push(subFamily3 || null); }
  if (subFamily4 !== undefined) { updates.push('sub_family_4 = ?'); values.push(subFamily4 || null); }
  if (subFamily5 !== undefined) { updates.push('sub_family_5 = ?'); values.push(subFamily5 || null); }
  if (partFamilyId !== undefined) { updates.push('part_family_id = ?'); values.push(partFamilyId || null); }
  if (locationId !== undefined) { updates.push('location_id = ?'); values.push(locationId || null); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  try {
    db.prepare('UPDATE spare_parts SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      const optionalCols = ['image_data', 'location', 'manufacturer_reference', 'stock_category', 'family', 'sub_family_1', 'sub_family_2', 'sub_family_3', 'sub_family_4', 'sub_family_5', 'unit_id', 'part_family_id', 'location_id'];
      const safeUpdates = [];
      const safeValues = [];
      updates.forEach((u, i) => {
        const col = u.split(' ')[0];
        if (!optionalCols.includes(col)) {
          safeUpdates.push(u);
          safeValues.push(values[i]);
        }
      });
      if (safeUpdates.length > 0) db.prepare('UPDATE spare_parts SET ' + safeUpdates.join(', ') + ' WHERE id = ?').run(...safeValues);
    } else throw e;
  }
  if (db._save) db._save();
  const row = db.prepare(`
    SELECT sp.*, s.name as supplier_name, COALESCE(sb.quantity, 0) as stock_quantity
    FROM spare_parts sp
    LEFT JOIN suppliers s ON sp.supplier_id = s.id
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE sp.id = ?
  `).get(id);
  res.json(row);
});

/**
 * GET /api/stock/parts/:id/movements
 */
router.get('/parts/:id/movements', param('id').isInt(), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT sm.*, u.first_name || ' ' || u.last_name as user_name
    FROM stock_movements sm
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE sm.spare_part_id = ?
    ORDER BY sm.created_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(rows);
});

/**
 * GET /api/stock/alerts
 */
router.get('/alerts', (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT sp.*, COALESCE(sb.quantity, 0) as stock_quantity, sp.min_stock
    FROM spare_parts sp
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE COALESCE(sb.quantity, 0) <= sp.min_stock
    ORDER BY COALESCE(sb.quantity, 0) ASC
  `).all();
  res.json(rows);
});

/**
 * GET /api/stock/quarantine — Pièces avec stock en quarantaine (contrôle qualité)
 */
router.get('/quarantine', (req, res) => {
  const db = req.db;
  if (!hasStatusColumns(db)) return res.json([]);
  try {
    const rows = db.prepare(`
      SELECT sp.id, sp.code, sp.name, sp.unit, s.name as supplier_name,
             COALESCE(sb.quantity_quarantine, 0) as quantity_quarantine,
             COALESCE(sb.quantity_accepted, 0) as quantity_accepted,
             COALESCE(sb.quantity_rejected, 0) as quantity_rejected
      FROM spare_parts sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      WHERE COALESCE(sb.quantity_quarantine, 0) > 0
      ORDER BY sp.code
    `).all();
    res.json(rows);
  } catch (_) { res.json([]); }
});

/**
 * POST /api/stock/quality/release — Libération (Q→A) ou rejet (Q→R) après contrôle qualité
 * Body: sparePartId, quantity, action ('release' | 'reject'), notes?
 */
router.post('/quality/release', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('sparePartId').isInt(),
  body('quantity').isInt({ min: 1 }),
  body('action').isIn(['release', 'reject']),
  body('notes').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (!hasStatusColumns(db)) return res.status(400).json({ error: 'Statuts de stock non disponibles. Exécutez les migrations.' });
  const { sparePartId, quantity, action, notes } = req.body;
  try {
    if (action === 'release') {
      releaseQuarantine(db, sparePartId, quantity);
      try {
        db.prepare('INSERT INTO quality_control_log (spare_part_id, quantity, action, user_id, notes) VALUES (?, ?, ?, ?, ?)').run(sparePartId, quantity, 'release', req.user?.id || null, notes || null);
      } catch (_) {}
    } else {
      rejectQuarantine(db, sparePartId, quantity);
      try {
        db.prepare('INSERT INTO quality_control_log (spare_part_id, quantity, action, user_id, notes) VALUES (?, ?, ?, ?, ?)').run(sparePartId, quantity, 'reject', req.user?.id || null, notes || null);
      } catch (_) {}
    }
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Quantité en quarantaine insuffisante' });
  }
  if (db._save) db._save();
  const bal = getBalance(db, sparePartId);
  const part = db.prepare('SELECT id, code, name FROM spare_parts WHERE id = ?').get(sparePartId);
  res.json({ sparePartId, quantity, action, balance: bal, part });
});

/**
 * POST /api/stock/quality/change-status — Changement de statut (total ou partiel) : A, Q, R
 * Body: sparePartId, fromStatus ('A'|'Q'|'R'), toStatus ('A'|'Q'|'R'), quantity, notes?
 */
router.post('/quality/change-status', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('sparePartId').isInt(),
  body('fromStatus').isIn(['A', 'Q', 'R']),
  body('toStatus').isIn(['A', 'Q', 'R']),
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (!hasStatusColumns(db)) return res.status(400).json({ error: 'Statuts de stock non disponibles. Exécutez les migrations.' });
  const { sparePartId, fromStatus, toStatus, quantity, notes } = req.body;
  try {
    changeStatus(db, sparePartId, fromStatus, toStatus, quantity);
    try {
      db.prepare('INSERT INTO quality_control_log (spare_part_id, quantity, action, user_id, notes) VALUES (?, ?, ?, ?, ?)')
        .run(sparePartId, quantity, `change_${fromStatus}_${toStatus}`, req.user?.id || null, notes || null);
    } catch (_) {}
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Changement de statut impossible' });
  }
  if (db._save) db._save();
  const bal = getBalance(db, sparePartId);
  const part = db.prepare('SELECT id, code, name FROM spare_parts WHERE id = ?').get(sparePartId);
  res.json({ sparePartId, quantity, fromStatus, toStatus, balance: bal, part });
});

/**
 * POST /api/stock/parts
 * Création d'une pièce avec fiche complète (image, emplacement, référence constructeur optionnels).
 */
router.post('/parts', requirePermission('stock', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('unit').optional().trim(),
  body('unitId').optional({ nullable: true }).isInt(),
  body('unitPrice').optional().isFloat({ min: 0 }),
  body('minStock').optional().isInt({ min: 0 }),
  body('supplierId').optional({ nullable: true }).isInt(),
  body('location').optional().trim(),
  body('manufacturerReference').optional().trim(),
  body('imageData').optional(),
  body('stockCategory').optional().trim(),
  body('family').optional().trim(),
  body('subFamily1').optional().trim(),
  body('subFamily2').optional().trim(),
  body('subFamily3').optional().trim(),
  body('subFamily4').optional().trim(),
  body('subFamily5').optional().trim(),
  body('partFamilyId').optional({ nullable: true }).isInt(),
  body('locationId').optional({ nullable: true }).isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const {
    code: codeProvided, name, description, unit, unitId, unitPrice, minStock, supplierId,
    location, manufacturerReference, imageData,
    stockCategory, family, subFamily1, subFamily2, subFamily3, subFamily4, subFamily5,
    partFamilyId, locationId
  } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'piece', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  let unitVal = unit || 'unit';
  if (unitId) {
    try {
      const u = db.prepare('SELECT name FROM units WHERE id = ?').get(unitId);
      if (u) unitVal = u.name;
    } catch (_) {}
  }
  try {
    let result;
    try {
      result = db.prepare(`
        INSERT INTO spare_parts (code, name, description, unit, unit_id, unit_price, min_stock, supplier_id, location, manufacturer_reference, image_data,
          stock_category, family, sub_family_1, sub_family_2, sub_family_3, sub_family_4, sub_family_5, part_family_id, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        code.trim(), name, description || null, unitVal, unitId || null, unitPrice || 0, minStock || 0, supplierId || null,
        location || null, manufacturerReference || null, imageData && String(imageData).trim() ? String(imageData).trim() : null,
        stockCategory || null, family || null, subFamily1 || null, subFamily2 || null, subFamily3 || null, subFamily4 || null, subFamily5 || null,
        partFamilyId || null, locationId || null
      );
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        try {
          result = db.prepare(`
            INSERT INTO spare_parts (code, name, description, unit, unit_id, unit_price, min_stock, supplier_id, location, manufacturer_reference, image_data,
              stock_category, family, sub_family_1, sub_family_2, sub_family_3, sub_family_4, sub_family_5)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            code.trim(), name, description || null, unitVal, unitId || null, unitPrice || 0, minStock || 0, supplierId || null,
            location || null, manufacturerReference || null, imageData && String(imageData).trim() ? String(imageData).trim() : null,
            stockCategory || null, family || null, subFamily1 || null, subFamily2 || null, subFamily3 || null, subFamily4 || null, subFamily5 || null
          );
        } catch (e2) {
          if (e2.message && e2.message.includes('no such column')) {
            try {
              result = db.prepare(`
                INSERT INTO spare_parts (code, name, description, unit, unit_price, min_stock, supplier_id, location, manufacturer_reference, image_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                code.trim(), name, description || null, unitVal, unitPrice || 0, minStock || 0, supplierId || null,
                location || null, manufacturerReference || null, imageData && String(imageData).trim() ? String(imageData).trim() : null
              );
            } catch (e3) {
              if (e3.message && e3.message.includes('no such column')) {
                result = db.prepare(`
                  INSERT INTO spare_parts (code, name, description, unit, unit_price, min_stock, supplier_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(code.trim(), name, description || null, unitVal, unitPrice || 0, minStock || 0, supplierId || null);
              } else throw e3;
            }
          } else throw e2;
        }
      } else throw e;
    }
    if (hasStatusColumns(db)) {
      db.prepare('INSERT INTO stock_balance (spare_part_id, quantity, quantity_accepted, quantity_quarantine, quantity_rejected) VALUES (?, 0, 0, 0, 0)').run(result.lastInsertRowid);
    } else {
      db.prepare('INSERT INTO stock_balance (spare_part_id, quantity) VALUES (?, 0)').run(result.lastInsertRowid);
    }
    let row;
    try {
      row = db.prepare(`
        SELECT sp.*, s.name as supplier_name, u.name as unit_name, 0 as stock_quantity
        FROM spare_parts sp LEFT JOIN suppliers s ON sp.supplier_id = s.id LEFT JOIN units u ON sp.unit_id = u.id WHERE sp.id = ?
      `).get(result.lastInsertRowid);
    } catch (_) {
      row = db.prepare(`
        SELECT sp.*, s.name as supplier_name, 0 as stock_quantity
        FROM spare_parts sp LEFT JOIN suppliers s ON sp.supplier_id = s.id WHERE sp.id = ?
      `).get(result.lastInsertRowid);
    }
    if (db._save) db._save();
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code piece deja existant' });
    throw e;
  }
});

/**
 * POST /api/stock/movements
 * Entrée (in) : option status 'A' (accepté) ou 'Q' (quarantaine). Sortie (out/transfer) : uniquement depuis stock Accepté.
 * quantity : pour in/out/transfer doit être >= 1 ; pour adjustment c'est le nouveau total (>= 0).
 */
router.post('/movements', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('sparePartId').isInt(),
  body('quantity').isInt(),
  body('movementType').isIn(['in', 'out', 'adjustment', 'transfer']),
  body('status').optional().isIn(['A', 'Q']),
  body('quantity').custom((val, { req }) => {
    const type = req.body.movementType;
    if (type === 'in' || type === 'out' || type === 'transfer') {
      const q = Number(val);
      if (q < 1) throw new Error('La quantité doit être au moins 1 pour une entrée, sortie ou transfert.');
    } else if (type === 'adjustment') {
      const q = Number(val);
      if (q < 0 || !Number.isFinite(q)) throw new Error('La quantité (nouveau total) doit être un nombre >= 0 pour un réglage.');
    }
    return true;
  })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(' ');
    return res.status(400).json({ error: msg || 'Données invalides' });
  }
  const { sparePartId, quantity, movementType, reference, workOrderId, notes, status } = req.body;
  const entryStatus = (status === STOCK_STATUS.Q ? STOCK_STATUS.Q : STOCK_STATUS.A);
  try {
    if (movementType === 'in') {
      addStockIn(db, sparePartId, quantity, entryStatus);
      const withStatus = hasMovementStatusColumn(db);
      if (withStatus) {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, quantity, movementType, reference || null, workOrderId || null, req.user.id, notes || null, entryStatus);
      } else {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, quantity, movementType, reference || null, workOrderId || null, req.user.id, notes || null);
      }
    } else if (movementType === 'out' || movementType === 'transfer') {
      deductStockOut(db, sparePartId, Math.abs(quantity));
      const delta = -Math.abs(quantity);
      if (hasMovementStatusColumn(db)) {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, delta, movementType, reference || null, workOrderId || null, req.user.id, notes || null, STOCK_STATUS.A);
      } else {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, delta, movementType, reference || null, workOrderId || null, req.user.id, notes || null);
      }
    } else {
      const cur = getBalance(db, sparePartId);
      const delta = quantity - cur.quantity;
      updateBalance(db, sparePartId, delta);
      if (hasMovementStatusColumn(db)) {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, delta, movementType, reference || null, workOrderId || null, req.user.id, notes || null, STOCK_STATUS.A);
      } else {
        db.prepare(`INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, work_order_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(sparePartId, delta, movementType, reference || null, workOrderId || null, req.user.id, notes || null);
      }
    }
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Stock insuffisant' });
  }
  if (db._save) db._save();
  const row = db.prepare('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 1').get();
  res.status(201).json(row);
});

module.exports = router;
