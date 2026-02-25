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
