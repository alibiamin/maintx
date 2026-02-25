/**
 * API Demandes de prix / RFQ (Request for Quotation)
 * Envoi aux fournisseurs, réception des devis.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['draft', 'sent', 'received', 'closed', 'cancelled'];

function nextRfqNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT rfq_number FROM price_requests WHERE rfq_number LIKE ? ORDER BY id DESC LIMIT 1').get(`DP-${year}-%`);
  const num = last ? parseInt(String(last.rfq_number).split('-')[2]) + 1 : 1;
  return `DP-${year}-${String(num).padStart(4, '0')}`;
}

function formatRfq(row, db) {
  if (!row) return null;
  let lines = [];
  try {
    lines = db.prepare(`
      SELECT prl.*, sp.code as part_code, sp.name as part_name
      FROM price_request_lines prl
      LEFT JOIN spare_parts sp ON sp.id = prl.spare_part_id
      WHERE prl.price_request_id = ?
    `).all(row.id);
  } catch (_) {}
  return {
    id: row.id,
    rfqNumber: row.rfq_number,
    title: row.title,
    description: row.description,
    supplierId: row.supplier_id,
    status: row.status,
    sentDate: row.sent_date,
    responseDueDate: row.response_due_date,
    responseDate: row.response_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supplierName: row.supplier_name,
    lines: lines.map(l => ({
      id: l.id,
      sparePartId: l.spare_part_id,
      partCode: l.part_code,
      partName: l.part_name,
      description: l.description,
      quantity: l.quantity,
      unitPriceQuoted: l.unit_price_quoted,
      supplierQuoteRef: l.supplier_quote_ref
    }))
  };
}

router.get('/', requirePermission('price_requests', 'view'), [
  query('status').optional().isIn(STATUSES),
  query('supplierId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='price_requests'").get();
    if (!hasTable) return res.json([]);
    let sql = `
      SELECT pr.*, s.name as supplier_name
      FROM price_requests pr
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.status) { sql += ' AND pr.status = ?'; params.push(req.query.status); }
    if (req.query.supplierId) { sql += ' AND pr.supplier_id = ?'; params.push(req.query.supplierId); }
    sql += ' ORDER BY pr.created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => formatRfq(r, db)));
  } catch (e) {
    console.error('[priceRequests] list', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('price_requests', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT pr.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone
      FROM price_requests pr
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pr.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Demande de prix non trouvée.' });
    res.json(formatRfq(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requirePermission('price_requests', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('supplierId').optional().isInt(),
  body('responseDueDate').optional().isISO8601(),
  body('lines').optional().isArray()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='price_requests'").get();
    if (!hasTable) return res.status(501).json({ error: 'Table price_requests absente.' });
    const rfqNumber = nextRfqNumber(db);
    const { title, description, supplierId, responseDueDate, lines = [] } = req.body;
    db.prepare(`
      INSERT INTO price_requests (rfq_number, title, description, supplier_id, response_due_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'draft', ?)
    `).run(rfqNumber, title, description || null, supplierId || null, responseDueDate || null, req.user.id);
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    for (const line of lines) {
      if (line.quantity > 0) {
        db.prepare(`
          INSERT INTO price_request_lines (price_request_id, spare_part_id, description, quantity, unit_price_quoted, supplier_quote_ref)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, line.sparePartId || null, line.description || null, line.quantity || 1, line.unitPriceQuoted ?? null, line.supplierQuoteRef || null);
      }
    }
    const row = db.prepare('SELECT * FROM price_requests WHERE id = ?').get(id);
    res.status(201).json(formatRfq(row, db));
  } catch (e) {
    console.error('[priceRequests] create', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requirePermission('price_requests', 'update'), param('id').isInt(), [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('supplierId').optional().isInt(),
  body('status').optional().isIn(STATUSES),
  body('sentDate').optional().isISO8601(),
  body('responseDate').optional().isISO8601(),
  body('responseDueDate').optional().isISO8601(),
  body('lines').optional().isArray()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare('SELECT id, status FROM price_requests WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Demande de prix non trouvée.' });
    const updates = [];
    const params = [];
    const map = { sentDate: 'sent_date', responseDate: 'response_date', responseDueDate: 'response_due_date', supplierId: 'supplier_id' };
    for (const [k, v] of Object.entries(req.body)) {
      const col = map[k] || k;
      if (['title', 'description', 'status', 'sent_date', 'response_date', 'response_due_date', 'supplier_id'].includes(col) && v !== undefined) {
        updates.push(`${col} = ?`);
        params.push(v);
      }
    }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE price_requests SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    }
    if (Array.isArray(req.body.lines) && (existing.status === 'draft' || existing.status === 'received')) {
      db.prepare('DELETE FROM price_request_lines WHERE price_request_id = ?').run(req.params.id);
      for (const line of req.body.lines) {
        if (line.quantity > 0) {
          db.prepare(`
            INSERT INTO price_request_lines (price_request_id, spare_part_id, description, quantity, unit_price_quoted, supplier_quote_ref)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(req.params.id, line.sparePartId || null, line.description || null, line.quantity || 1, line.unitPriceQuoted ?? null, line.supplierQuoteRef || null);
        }
      }
    }
    const row = db.prepare('SELECT pr.*, s.name as supplier_name FROM price_requests pr LEFT JOIN suppliers s ON s.id = pr.supplier_id WHERE pr.id = ?').get(req.params.id);
    res.json(formatRfq(row, db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('price_requests', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT status FROM price_requests WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Demande de prix non trouvée.' });
    if (row.status !== 'draft' && row.status !== 'cancelled') {
      return res.status(400).json({ error: 'Seules les demandes brouillon ou annulées peuvent être supprimées.' });
    }
    db.prepare('DELETE FROM price_request_lines WHERE price_request_id = ?').run(req.params.id);
    const r = db.prepare('DELETE FROM price_requests WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Demande de prix non trouvée.' });
    res.json({ message: 'Demande de prix supprimée.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
