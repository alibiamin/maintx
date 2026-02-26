/**
 * API Demandes d'achat (purchase requests)
 * Chaîne achats type Coswin : demande → validation → conversion en commande.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled'];

function nextPrNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT pr_number FROM purchase_requests WHERE pr_number LIKE ? ORDER BY id DESC LIMIT 1').get(`DA-${year}-%`);
  const num = last ? parseInt(String(last.pr_number).split('-')[2]) + 1 : 1;
  return `DA-${year}-${String(num).padStart(4, '0')}`;
}

function formatPr(row, db) {
  if (!row) return null;
  let lines = [];
  try {
    lines = db.prepare(`
      SELECT prl.*, sp.code as part_code, sp.name as part_name
      FROM purchase_request_lines prl
      LEFT JOIN spare_parts sp ON sp.id = prl.spare_part_id
      WHERE prl.purchase_request_id = ?
    `).all(row.id);
  } catch (_) {}
  return {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    description: row.description,
    requestedBy: row.requested_by,
    requestDate: row.request_date,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    supplierOrderId: row.supplier_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: lines.map(l => ({
      id: l.id,
      sparePartId: l.spare_part_id,
      partCode: l.part_code,
      partName: l.part_name,
      description: l.description,
      quantity: l.quantity,
      unitPriceEstimate: l.unit_price_estimate
    }))
  };
}

router.get('/', requirePermission('purchase_requests', 'view'), [
  query('status').optional().isIn(STATUSES)
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='purchase_requests'").get();
    if (!hasTable) return res.json([]);
    let sql = 'SELECT * FROM purchase_requests WHERE 1=1';
    const params = [];
    if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY request_date DESC, id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatPr(r, db)));
  } catch (e) {
    console.error('[purchaseRequests] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('purchase_requests', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Demande d\'achat non trouvée.' });
    res.json(formatPr(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('purchase_requests', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('lines').optional().isArray(),
  body('lines.*.sparePartId').optional().isInt(),
  body('lines.*.description').optional().trim(),
  body('lines.*.quantity').optional().isInt({ min: 1 }),
  body('lines.*.unitPriceEstimate').optional().isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='purchase_requests'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table purchase_requests absente.' });
    const prNumber = nextPrNumber(db);
    const { title, description, lines = [] } = req.body;
    db.prepare(`
      INSERT INTO purchase_requests (pr_number, title, description, requested_by, request_date, status)
      VALUES (?, ?, ?, ?, date('now'), 'draft')
    `).run(prNumber, title, description || null, req.user.id);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    for (const line of lines) {
      if (line.quantity > 0) {
        db.prepare(`
          INSERT INTO purchase_request_lines (purchase_request_id, spare_part_id, description, quantity, unit_price_estimate)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, line.sparePartId || null, line.description || null, line.quantity || 1, line.unitPriceEstimate || 0);
      }
    }
    const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id);
    res.status(201).json(formatPr(row, db));
  } catch (e) {
    console.error('[purchaseRequests] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('purchase_requests', 'update'), param('id').isInt(), [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('status').optional().isIn(STATUSES),
  body('rejectionReason').optional().trim(),
  body('lines').optional().isArray()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id, status FROM purchase_requests WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Demande d\'achat non trouvée.' });
    if (existing.status !== 'draft' && req.body.title !== undefined) {
      return res.status(400).json({ error: 'Seules les demandes brouillon peuvent être modifiées (titre/description).' });
    }
    const updates = [];
    const params = [];
    if (req.body.title !== undefined) { updates.push('title = ?'); params.push(req.body.title); }
    if (req.body.description !== undefined) { updates.push('description = ?'); params.push(req.body.description); }
    if (req.body.status !== undefined) { updates.push('status = ?'); params.push(req.body.status); }
    if (req.body.rejectionReason !== undefined) { updates.push('rejection_reason = ?'); params.push(req.body.rejectionReason); }
    if (req.body.status === 'approved') {
      updates.push('approved_by = ?', 'approved_at = CURRENT_TIMESTAMP');
      params.push(req.user.id);
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE purchase_requests SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    if (Array.isArray(req.body.lines) && existing.status === 'draft') {
      db.prepare('DELETE FROM purchase_request_lines WHERE purchase_request_id = ?').run(req.params.id);
      for (const line of req.body.lines) {
        if (line.quantity > 0) {
          db.prepare(`
            INSERT INTO purchase_request_lines (purchase_request_id, spare_part_id, description, quantity, unit_price_estimate)
            VALUES (?, ?, ?, ?, ?)
          `).run(req.params.id, line.sparePartId || null, line.description || null, line.quantity || 1, line.unitPriceEstimate || 0);
        }
      }
    }
    const row = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id);
    res.json(formatPr(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('purchase_requests', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT status FROM purchase_requests WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Demande d\'achat non trouvée.' });
    if (row.status !== 'draft' && row.status !== 'cancelled') {
      return res.status(400).json({ error: 'Seules les demandes brouillon ou annulées peuvent être supprimées.' });
    }
    db.prepare('DELETE FROM purchase_request_lines WHERE purchase_request_id = ?').run(req.params.id);
    const r = db.prepare('DELETE FROM purchase_requests WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Demande d\'achat non trouvée.' });
    res.json({ message: 'Demande d\'achat supprimée.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/purchase-requests/:id/convert-to-order
 * Convertit la demande d'achat en commande fournisseur (sélection du fournisseur).
 * Body: { supplierId }
 */
router.post('/:id/convert-to-order', requirePermission('purchase_requests', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('supplierId').isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const prId = parseInt(req.params.id, 10);
    const pr = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(prId);
    if (!pr) return res.status(404).json({ error: 'Demande d\'achat non trouvée.' });
    if (pr.status === 'ordered') return res.status(400).json({ error: 'Demande déjà convertie en commande.' });
    if (pr.status === 'rejected' || pr.status === 'cancelled') return res.status(400).json({ error: 'Demande non convertible.' });
    const lines = db.prepare('SELECT * FROM purchase_request_lines WHERE purchase_request_id = ?').all(prId);
    if (!lines.length) return res.status(400).json({ error: 'Aucune ligne à commander.' });
    const supplierId = parseInt(req.body.supplierId, 10);
    const year = new Date().getFullYear();
    const last = db.prepare('SELECT order_number FROM supplier_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1').get(`CMD-${year}-%`);
    const num = last ? parseInt(last.order_number.split('-')[2]) + 1 : 1;
    const orderNumber = `CMD-${year}-${String(num).padStart(4, '0')}`;
    db.prepare(`
      INSERT INTO supplier_orders (order_number, supplier_id, status, order_date, total_amount, created_by)
      VALUES (?, ?, 'sent', date('now'), 0, ?)
    `).run(orderNumber, supplierId, req.user.id);
    const orderId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    let total = 0;
    for (const line of lines) {
      const unitPrice = line.unit_price_estimate || 0;
      const lineTotal = (line.quantity || 1) * unitPrice;
      total += lineTotal;
      db.prepare(`
        INSERT INTO supplier_order_lines (order_id, spare_part_id, description, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, line.spare_part_id || null, line.description || null, line.quantity || 1, unitPrice);
    }
    db.prepare('UPDATE supplier_orders SET total_amount = ? WHERE id = ?').run(Math.round(total * 100) / 100, orderId);
    db.prepare('UPDATE purchase_requests SET status = ?, supplier_order_id = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('ordered', orderId, req.user.id, prId);
    try {
      db.prepare('UPDATE reorder_requests SET status = ?, supplier_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE purchase_request_id = ?')
        .run('ordered', orderId, prId);
    } catch (_) {}
    const order = db.prepare(`
      SELECT so.*, s.name as supplier_name FROM supplier_orders so
      JOIN suppliers s ON so.supplier_id = s.id WHERE so.id = ?
    `).get(orderId);
    const orderLines = db.prepare(`
      SELECT sol.*, sp.code as part_code, sp.name as part_name
      FROM supplier_order_lines sol
      LEFT JOIN spare_parts sp ON sol.spare_part_id = sp.id
      WHERE sol.order_id = ?
    `).all(orderId);
    res.status(201).json({ order: { ...order, lines: orderLines }, purchaseRequestId: prId });
  } catch (e) {
    console.error('[purchaseRequests] convert-to-order', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
