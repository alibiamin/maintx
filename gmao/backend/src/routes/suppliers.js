/**
 * API Gestion des fournisseurs et commandes
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

function generateOrderNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT order_number FROM supplier_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1').get(`CMD-${year}-%`);
  const num = last ? parseInt(last.order_number.split('-')[2]) + 1 : 1;
  return `CMD-${year}-${String(num).padStart(4, '0')}`;
}

router.get('/', requirePermission('suppliers', 'view'), (req, res) => {
  const db = req.db;
  const { search } = req.query;
  let sql = 'SELECT * FROM suppliers WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (code LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Commandes - routes avant :id pour éviter conflit
router.get('/orders', requirePermission('suppliers', 'view'), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT so.*, s.name as supplier_name, u.first_name || ' ' || u.last_name as created_by_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN users u ON so.created_by = u.id
    ORDER BY so.created_at DESC
  `).all();
  res.json(rows);
});

router.get('/orders/:orderId', requirePermission('suppliers', 'view'), param('orderId').isInt(), (req, res) => {
  const db = req.db;
  const order = db.prepare(`
    SELECT so.*, s.name as supplier_name, s.contact_person, s.email, s.phone
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    WHERE so.id = ?
  `).get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Commande non trouvee' });
  const lines = db.prepare(`
    SELECT sol.*, sp.code as part_code, sp.name as part_name
    FROM supplier_order_lines sol
    LEFT JOIN spare_parts sp ON sol.spare_part_id = sp.id
    WHERE sol.order_id = ?
  `).all(req.params.orderId);
  res.json({ ...order, lines });
});

router.post('/orders', requirePermission('suppliers', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('supplierId').isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const orderNumber = generateOrderNumber(db);
  const result = db.prepare(`
    INSERT INTO supplier_orders (order_number, supplier_id, status, order_date, created_by)
    VALUES (?, ?, 'draft', date('now'), ?)
  `).run(orderNumber, req.body.supplierId, req.user.id);
  const row = db.prepare(`
    SELECT so.*, s.name as supplier_name FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id WHERE so.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.post('/orders/:orderId/lines', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('orderId').isInt(), [
  body('sparePartId').optional().isInt(),
  body('description').optional(),
  body('quantity').isInt({ min: 1 }),
  body('unitPrice').optional().isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { sparePartId, description, quantity, unitPrice } = req.body;
  db.prepare(`
    INSERT INTO supplier_order_lines (order_id, spare_part_id, description, quantity, unit_price)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.orderId, sparePartId || null, description || null, quantity, unitPrice || 0);
  const line = db.prepare('SELECT * FROM supplier_order_lines ORDER BY id DESC LIMIT 1').get();
  res.status(201).json(line);
});

/**
 * POST /api/suppliers/orders/:orderId/receive
 * Réception de la commande : statut → received, création des entrées stock pour chaque ligne.
 */
router.post('/orders/:orderId/receive', requirePermission('suppliers', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('orderId').isInt(), (req, res) => {
  const db = req.db;
  const orderId = parseInt(req.params.orderId, 10);
  const order = db.prepare('SELECT * FROM supplier_orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée.' });
  if (order.status === 'received') return res.status(400).json({ error: 'Commande déjà réceptionnée.' });
  const lines = db.prepare('SELECT * FROM supplier_order_lines WHERE order_id = ?').all(orderId);
  const hasStatusCols = (() => { try { db.prepare('SELECT quantity_accepted FROM stock_balance LIMIT 1').get(); return true; } catch (_) { return false; } })();
  const ref = order.order_number || `CMD-${orderId}`;
  for (const line of lines) {
    if (!line.spare_part_id || !(line.quantity > 0)) continue;
    const qty = line.quantity;
    try {
      const cur = db.prepare('SELECT quantity, quantity_accepted FROM stock_balance WHERE spare_part_id = ?').get(line.spare_part_id);
      if (cur) {
        if (hasStatusCols) {
          db.prepare(`
            UPDATE stock_balance SET quantity = quantity + ?, quantity_accepted = quantity_accepted + ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
          `).run(qty, qty, line.spare_part_id);
        } else {
          db.prepare(`
            UPDATE stock_balance SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE spare_part_id = ?
          `).run(qty, line.spare_part_id);
        }
      } else {
        if (hasStatusCols) {
          db.prepare(`
            INSERT INTO stock_balance (spare_part_id, quantity, quantity_accepted, quantity_quarantine, quantity_rejected, updated_at)
            VALUES (?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
          `).run(line.spare_part_id, qty, qty);
        } else {
          db.prepare('INSERT INTO stock_balance (spare_part_id, quantity, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(line.spare_part_id, qty);
        }
      }
      try {
        db.prepare(`
          INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes, status)
          VALUES (?, ?, 'in', ?, ?, ?, 'A')
        `).run(line.spare_part_id, qty, ref, req.user?.id || null, `Réception ${ref}`);
      } catch (_) {
        db.prepare(`
          INSERT INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes)
          VALUES (?, ?, 'in', ?, ?, ?)
        `).run(line.spare_part_id, qty, ref, req.user?.id || null, `Réception ${ref}`);
      }
      db.prepare('UPDATE supplier_order_lines SET received_quantity = ? WHERE id = ?').run(qty, line.id);
    } catch (e) {
      console.warn('[suppliers] receive line', line.id, e.message);
    }
  }
  db.prepare('UPDATE supplier_orders SET status = ?, received_date = date(\'now\'), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('received', orderId);
  try {
    db.prepare('UPDATE reorder_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE supplier_order_id = ?').run('received', orderId);
  } catch (_) {}
  const updated = db.prepare(`
    SELECT so.*, s.name as supplier_name FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id WHERE so.id = ?
  `).get(orderId);
  const orderLines = db.prepare(`
    SELECT sol.*, sp.code as part_code, sp.name as part_name
    FROM supplier_order_lines sol LEFT JOIN spare_parts sp ON sol.spare_part_id = sp.id
    WHERE sol.order_id = ?
  `).all(orderId);
  res.json({ order: { ...updated, lines: orderLines } });
});

router.get('/:id', requirePermission('suppliers', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Fournisseur non trouve' });
  res.json(row);
});

router.get('/:id/orders', requirePermission('suppliers', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT so.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM supplier_orders so
    LEFT JOIN users u ON so.created_by = u.id
    WHERE so.supplier_id = ?
    ORDER BY so.created_at DESC
  `).all(req.params.id);
  res.json(rows);
});

router.post('/', requirePermission('suppliers', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, contactPerson, email, phone, address } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'fournisseur', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const result = db.prepare(`
      INSERT INTO suppliers (code, name, contact_person, email, phone, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code.trim(), name, contactPerson || null, email || null, phone || null, address || null);
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code fournisseur deja existant' });
    throw e;
  }
});

router.put('/:id', requirePermission('suppliers', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Fournisseur non trouve' });
  const { code, name, contactPerson, email, phone, address } = req.body;
  const updates = [];
  const values = [];
  if (code !== undefined) { updates.push('code = ?'); values.push(code); }
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (contactPerson !== undefined) { updates.push('contact_person = ?'); values.push(contactPerson); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address); }
  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare('UPDATE suppliers SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  }
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  res.json(row);
});

module.exports = router;
