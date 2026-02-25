/**
 * API Factures fournisseur
 * Suivi des factures, rapprochement avec les commandes.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['draft', 'received', 'paid', 'cancelled'];

function formatInvoice(row, db) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    supplierId: row.supplier_id,
    supplierOrderId: row.supplier_order_id,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    totalAmount: row.total_amount,
    currency: row.currency,
    status: row.status,
    filePath: row.file_path,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supplierName: row.supplier_name,
    orderNumber: row.order_number
  };
}

router.get('/', requirePermission('supplier_invoices', 'view'), [
  query('status').optional().isIn(STATUSES),
  query('supplierId').optional().isInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='supplier_invoices'").get();
    if (!hasTable) return res.json([]);
    let sql = `
      SELECT si.*, s.name as supplier_name, so.order_number
      FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN supplier_orders so ON so.id = si.supplier_order_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.status) { sql += ' AND si.status = ?'; params.push(req.query.status); }
    if (req.query.supplierId) { sql += ' AND si.supplier_id = ?'; params.push(req.query.supplierId); }
    if (req.query.from) { sql += ' AND date(si.invoice_date) >= date(?)'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND date(si.invoice_date) <= date(?)'; params.push(req.query.to); }
    sql += ' ORDER BY si.invoice_date DESC, si.id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatInvoice(r, db)));
  } catch (e) {
    console.error('[supplierInvoices] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('supplier_invoices', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT si.*, s.name as supplier_name, s.contact_person, s.email, s.phone,
             so.order_number, so.order_date, so.status as order_status
      FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN supplier_orders so ON so.id = si.supplier_order_id
      WHERE si.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Facture non trouvée.' });
    res.json(formatInvoice(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('supplier_invoices', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('invoiceNumber').trim().notEmpty(),
  body('supplierId').isInt(),
  body('invoiceDate').notEmpty(),
  body('totalAmount').isFloat({ min: 0 }),
  body('supplierOrderId').optional().isInt(),
  body('dueDate').optional().isISO8601(),
  body('currency').optional().trim(),
  body('notes').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='supplier_invoices'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table supplier_invoices absente.' });
    const { invoiceNumber, supplierId, supplierOrderId, invoiceDate, dueDate, totalAmount, currency, notes } = req.body;
    const existing = db.prepare('SELECT id FROM supplier_invoices WHERE invoice_number = ?').get(invoiceNumber);
    if (existing) return res.status(400).json({ error: 'Numéro de facture déjà utilisé.' });
    db.prepare(`
      INSERT INTO supplier_invoices (invoice_number, supplier_id, supplier_order_id, invoice_date, due_date, total_amount, currency, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `).run(invoiceNumber, supplierId, supplierOrderId || null, invoiceDate, dueDate || null, totalAmount, currency || 'EUR', notes || null, req.user.id);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    const row = db.prepare(`
      SELECT si.*, s.name as supplier_name, so.order_number
      FROM supplier_invoices si JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN supplier_orders so ON so.id = si.supplier_order_id WHERE si.id = ?
    `).get(id);
    res.status(201).json(formatInvoice(row, db));
  } catch (e) {
    console.error('[supplierInvoices] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('supplier_invoices', 'update'), param('id').isInt(), [
  body('invoiceNumber').optional().trim().notEmpty(),
  body('invoiceDate').optional().notEmpty(),
  body('dueDate').optional().isISO8601(),
  body('totalAmount').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(STATUSES),
  body('notes').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id FROM supplier_invoices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Facture non trouvée.' });
    const updates = [];
    const params = [];
    const map = { invoiceNumber: 'invoice_number', invoiceDate: 'invoice_date', dueDate: 'due_date', totalAmount: 'total_amount' };
    for (const [k, v] of Object.entries(req.body)) {
      const col = map[k] || k;
      if (['invoice_number', 'invoice_date', 'due_date', 'total_amount', 'status', 'notes'].includes(col) && v !== undefined) {
        updates.push(`${col} = ?`);
        params.push(v);
      }
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE supplier_invoices SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    const row = db.prepare(`
      SELECT si.*, s.name as supplier_name, so.order_number
      FROM supplier_invoices si JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN supplier_orders so ON so.id = si.supplier_order_id WHERE si.id = ?
    `).get(req.params.id);
    res.json(formatInvoice(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('supplier_invoices', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT status FROM supplier_invoices WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Facture non trouvée.' });
    if (row.status !== 'draft') {
      return res.status(400).json({ error: 'Seules les factures brouillon peuvent être supprimées.' });
    }
    const r = db.prepare('DELETE FROM supplier_invoices WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Facture non trouvée.' });
    res.json({ message: 'Facture supprimée.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
