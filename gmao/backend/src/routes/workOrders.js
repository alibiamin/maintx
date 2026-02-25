/**
 * API Ordres de travail - Maintenance corrective et préventive
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');
const dbModule = require('../database/db');

const router = express.Router();
const woUploadsDir = path.join(__dirname, '../../uploads/work-order-attachments');
if (!fs.existsSync(woUploadsDir)) fs.mkdirSync(woUploadsDir, { recursive: true });

const ALLOWED_OT_EXT = /\.(jpe?g|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|odt|ods|csv)$/i;
const ALLOWED_OT_MIMES = /^(image\/(jpeg|png|gif|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml|spreadsheetml)|text\/plain|application\/vnd\.oasis\.opendocument\.(text|spreadsheet)|text\/csv)/;

const woUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, woUploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_')}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extOk = ALLOWED_OT_EXT.test(path.extname(file.originalname || ''));
    const mimeOk = ALLOWED_OT_MIMES.test(file.mimetype || '');
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Type de fichier non autorisé. Autorisés : images, PDF, Office, texte, CSV.'));
  }
});
router.use(authenticate);

/** Retourne true si le paramètre :id est invalide (réponse 400 déjà envoyée) */
function validateIdParam(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

function getUsersByRole(db, tenantId, roleNames) {
  const placeholders = roleNames.map(() => '?').join(',');
  if (tenantId != null) {
    try {
      const adminDb = dbModule.getAdminDb();
      return adminDb.prepare(`
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN (${placeholders})
      `).all(tenantId, ...roleNames).map((u) => u.id);
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        return dbModule.getAdminDb().prepare(`
          SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
          WHERE u.is_active = 1 AND r.name IN (${placeholders})
        `).all(...roleNames).map((u) => u.id);
      }
      throw e;
    }
  }
  return db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND r.name IN (${placeholders})
  `).all(...roleNames).map((u) => u.id);
}

function formatWO(row, costs = null) {
  if (!row) return null;
  const out = {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentCode: row.equipment_code,
    typeId: row.type_id,
    typeName: row.type_name,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    maintenancePlanId: row.maintenance_plan_id,
    maintenancePlanName: row.maintenance_plan_name,
    procedureId: row.procedure_id,
    projectId: row.project_id,
    failureDate: row.failure_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    signatureName: row.signature_name
  };
  if (costs) {
    out.laborCost = costs.laborCost;
    out.partsCost = costs.partsCost;
    out.reservationsCost = costs.reservationsCost;
    out.extraFeesCost = costs.extraFeesCost;
    out.totalCost = costs.totalCost;
  }
  if (row.procedure_name !== undefined) out.procedureName = row.procedure_name;
  if (row.procedure_description !== undefined) out.procedureDescription = row.procedure_description;
  if (row.procedure_steps !== undefined) out.procedureSteps = row.procedure_steps;
  if (row.procedure_safety_notes !== undefined) out.procedureSafetyNotes = row.procedure_safety_notes;
  // Workflow : draft | planned | in_progress | to_validate | pending_approval | closed
  out.statusWorkflow = row.status_workflow ?? (row.status === 'completed' ? 'closed' : row.status === 'in_progress' ? 'in_progress' : row.status === 'pending' ? 'planned' : row.status === 'cancelled' || row.status === 'deferred' ? row.status : 'planned');
  return out;
}

function getWorkOrderCosts(db, woId) {
  let defaultHourlyRate = 0;
  try {
    const r = db.prepare("SELECT value FROM app_settings WHERE key = 'hourly_rate'").get();
    if (r?.value) defaultHourlyRate = parseFloat(r.value) || 0;
  } catch (_) {}
  if (defaultHourlyRate <= 0) defaultHourlyRate = 45;

  let adminDb = null;
  try { adminDb = dbModule.getAdminDb(); } catch (_) {}
  const userDb = adminDb || db;

  let partsCost = 0;
  try {
    const parts = db.prepare(`
      SELECT COALESCE(SUM(i.quantity_used * COALESCE(sp.unit_price, 0)), 0) as parts_cost
      FROM interventions i
      LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
      WHERE i.work_order_id = ? AND (i.quantity_used IS NULL OR i.quantity_used > 0)
    `).get(woId);
    partsCost += Number(parts?.parts_cost) || 0;
  } catch (_) {}
  try {
    const mov = db.prepare(`
      SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(sp.unit_price, 0)), 0) as mov_cost
      FROM stock_movements sm
      LEFT JOIN spare_parts sp ON sm.spare_part_id = sp.id
      WHERE sm.work_order_id = ? AND sm.movement_type = 'out'
    `).get(woId);
    partsCost += Number(mov?.mov_cost) || 0;
  } catch (_) {}
  try {
    const consumed = db.prepare(`
      SELECT COALESCE(SUM(c.quantity * COALESCE(c.unit_cost_at_use, sp.unit_price, 0)), 0) as consumed_cost
      FROM work_order_consumed_parts c
      LEFT JOIN spare_parts sp ON c.spare_part_id = sp.id
      WHERE c.work_order_id = ?
    `).get(woId);
    partsCost += Number(consumed?.consumed_cost) || 0;
  } catch (_) {}

  const wo = db.prepare('SELECT actual_start, actual_end, assigned_to FROM work_orders WHERE id = ?').get(woId);
  let laborCost = 0;
  const hasStart = wo && wo.actual_start;
  const endTime = wo && wo.actual_end ? new Date(wo.actual_end) : new Date();
  const durationHours = hasStart ? Math.max(0, (endTime - new Date(wo.actual_start)) / (1000 * 60 * 60)) : 0;

  if (hasStart && durationHours > 0) {
    let operatorIds = [];
    try {
      const rows = db.prepare('SELECT user_id FROM work_order_operators WHERE work_order_id = ?').all(woId);
      operatorIds = (rows || []).map((r) => r.user_id);
    } catch (_) {}
    if (operatorIds.length === 0 && wo.assigned_to) operatorIds = [wo.assigned_to];
    if (operatorIds.length === 0) operatorIds = [null];
    for (const uid of operatorIds) {
      let rate = defaultHourlyRate;
      if (uid != null) {
        try {
          const rateRow = userDb.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(uid);
          if (rateRow?.hourly_rate != null && rateRow.hourly_rate !== '') rate = parseFloat(rateRow.hourly_rate);
        } catch (_) {}
      }
      laborCost += durationHours * rate;
    }
  }
  if (laborCost === 0) {
    try {
      const interventionRows = db.prepare(`
        SELECT i.hours_spent, i.technician_id
        FROM interventions i
        WHERE i.work_order_id = ?
      `).all(woId);
      interventionRows.forEach((row) => {
        const hours = parseFloat(row.hours_spent) || 0;
        let rate = defaultHourlyRate;
        if (row.technician_id != null && userDb) {
          try {
            const rateRow = userDb.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(row.technician_id);
            if (rateRow?.hourly_rate != null && rateRow.hourly_rate !== '') rate = parseFloat(rateRow.hourly_rate);
          } catch (_) {}
        }
        laborCost += hours * rate;
      });
    } catch (_) {}
  }
  if (laborCost === 0) {
    try {
      const phaseRows = db.prepare('SELECT hours_spent FROM work_order_phase_times WHERE work_order_id = ?').all(woId);
      phaseRows.forEach((row) => {
        laborCost += (parseFloat(row.hours_spent) || 0) * defaultHourlyRate;
      });
    } catch (_) {}
  }

  let reservationsCost = 0;
  try {
    const resRow = db.prepare(`
      SELECT COALESCE(SUM(r.quantity * sp.unit_price), 0) as res_cost
      FROM work_order_reservations r
      JOIN spare_parts sp ON r.spare_part_id = sp.id
      WHERE r.work_order_id = ?
    `).get(woId);
    reservationsCost = Number(resRow?.res_cost) || 0;
  } catch (_) {}

  let extraFeesCost = 0;
  try {
    const extra = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM work_order_extra_fees WHERE work_order_id = ?').get(woId);
    extraFeesCost = Number(extra?.s) || 0;
  } catch (e) {
    if (e && e.message && (e.message.includes('no such table') || e.message.includes('work_order_extra_fees'))) {
      try {
        const dbModule = require('../database/db');
        if (typeof dbModule.ensureClientMigrations === 'function') dbModule.ensureClientMigrations(db);
        const retry = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM work_order_extra_fees WHERE work_order_id = ?').get(woId);
        extraFeesCost = Number(retry?.s) || 0;
      } catch (_) {}
    }
  }

  const totalCost = laborCost + partsCost + reservationsCost + extraFeesCost;
  return {
    laborCost: Math.round(laborCost * 100) / 100,
    partsCost: Math.round(partsCost * 100) / 100,
    reservationsCost: Math.round(reservationsCost * 100) / 100,
    extraFeesCost: Math.round(extraFeesCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100
  };
}

/**
 * Génère un numéro d'OT unique
 */
function generateOTNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT number FROM work_orders WHERE number LIKE ? ORDER BY id DESC LIMIT 1').get(`OT-${year}-%`);
  const num = last ? parseInt(last.number.split('-')[2]) + 1 : 1;
  return `OT-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * GET /api/work-orders
 * Query: status, assignedTo, equipmentId, priority, page (1-based), limit (default 20)
 * If page/limit provided: Response { data: [...], total: N }. Otherwise: array (backward compatible).
 */
router.get('/', requirePermission('work_orders', 'view'), (req, res) => {
  const db = req.db;
  const { status, assignedTo, equipmentId, priority, projectId, page, limit } = req.query;
  const usePagination = page !== undefined && page !== '';
  const limitNum = usePagination ? Math.min(parseInt(limit, 10) || 20, 100) : 1e6;
  const offset = usePagination ? ((parseInt(page, 10) || 1) - 1) * limitNum : 0;
  let where = ' WHERE 1=1';
  const params = [];
  if (status) { where += ' AND wo.status = ?'; params.push(status); }
  if (assignedTo) { where += ' AND wo.assigned_to = ?'; params.push(assignedTo); }
  if (equipmentId) { where += ' AND wo.equipment_id = ?'; params.push(equipmentId); }
  if (priority) { where += ' AND wo.priority = ?'; params.push(priority); }
  if (projectId) { where += ' AND wo.project_id = ?'; params.push(projectId); }
  let total = 0;
  if (usePagination) {
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM work_orders wo ${where}`).get(...params);
    total = countRow?.total ?? 0;
  }
  const sortBy = (req.query.sortBy === 'title' || req.query.sortBy === 'number') ? req.query.sortBy : 'created_at';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const orderCol = sortBy === 'number' ? 'wo.number' : sortBy === 'title' ? 'wo.title' : 'wo.created_at';
  const sql = `
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    ${where}
    ORDER BY ${orderCol} ${order} LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limitNum, offset);
  const byId = new Map();
  rows.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
  const data = [...byId.values()].map(formatWO);
  if (usePagination) res.json({ data, total });
  else res.json(data);
});

/**
 * GET /api/work-orders/types
 */
router.get('/types', requirePermission('work_orders', 'view'), (req, res) => {
  const db = req.db;
  const types = db.prepare('SELECT * FROM work_order_types ORDER BY name').all();
  res.json(types);
});

/**
 * GET /api/work-orders/calendar
 * OT pour affichage calendrier
 */
router.get('/calendar', requirePermission('work_orders', 'view'), (req, res) => {
  const db = req.db;
  const { start, end } = req.query;
  const s = start || '1900-01-01';
  const e = end || '2100-12-31';
  const rows = db.prepare(`
    SELECT wo.id, wo.number, wo.title, wo.planned_start, wo.planned_end, wo.status, wo.priority,
           wo.assigned_to, wo.equipment_id, wo.created_at,
           e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.status IN ('pending', 'in_progress')
    AND (
      (wo.planned_start BETWEEN ? AND ?) OR (wo.planned_end BETWEEN ? AND ?)
      OR (wo.planned_start IS NULL AND wo.created_at BETWEEN ? AND ?)
    )
  `).all(s, e, s, e, s, e);
  res.json(rows);
});

/**
 * GET /api/work-orders/:id/reservations — Réservations de pièces pour cet OT
 */
router.get('/:id/reservations', requirePermission('work_orders', 'view'), param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const woId = req.params.id;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT r.id, r.work_order_id, r.spare_part_id, r.quantity, r.notes, r.created_at,
             sp.code as part_code, sp.name as part_name, sp.unit_price,
             COALESCE(sb.quantity, 0) as stock_quantity
      FROM work_order_reservations r
      JOIN spare_parts sp ON r.spare_part_id = sp.id
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      WHERE r.work_order_id = ?
      ORDER BY sp.code
    `).all(woId);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  const unitPrice = (r) => (r.unit_price != null ? Number(r.unit_price) : 0);
  res.json(rows.map(r => {
    const up = unitPrice(r);
    const lineCost = (r.quantity || 0) * up;
    return {
      id: r.id,
      workOrderId: r.work_order_id,
      sparePartId: r.spare_part_id,
      quantity: r.quantity,
      notes: r.notes,
      createdAt: r.created_at,
      partCode: r.part_code,
      partName: r.part_name,
      unitPrice: up,
      lineCost: Math.round(lineCost * 100) / 100,
      stockQuantity: r.stock_quantity
    };
  }));
});

/**
 * POST /api/work-orders/:id/reservations — Réserver des pièces pour l'OT
 */
router.post('/:id/reservations', requirePermission('work_orders', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('sparePartId').isInt(),
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const woId = req.params.id;
  const { sparePartId, quantity, notes } = req.body;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const part = db.prepare('SELECT id, code, name FROM spare_parts WHERE id = ?').get(sparePartId);
  if (!part) return res.status(404).json({ error: 'Pièce non trouvée' });
  let available = 0;
  try {
    const bal = db.prepare('SELECT quantity_accepted, quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
    available = bal?.quantity_accepted ?? bal?.quantity ?? 0;
  } catch (_) {
    const bal = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
    available = bal?.quantity ?? 0;
  }
  const existing = db.prepare('SELECT id, quantity FROM work_order_reservations WHERE work_order_id = ? AND spare_part_id = ?').get(woId, sparePartId);
  const newQuantity = existing ? (existing.quantity || 0) + quantity : quantity;
  if (available < newQuantity) {
    return res.status(400).json({
      error: `Stock accepté insuffisant. Disponible (statut A) : ${available}. Demandé : ${newQuantity} (déjà réservé : ${existing ? existing.quantity : 0}).`
    });
  }
  try {
    if (existing) {
      db.prepare(`
        UPDATE work_order_reservations SET quantity = quantity + ?, notes = COALESCE(?, notes) WHERE work_order_id = ? AND spare_part_id = ?
      `).run(quantity, notes || null, woId, sparePartId);
    } else {
      db.prepare(`
        INSERT INTO work_order_reservations (work_order_id, spare_part_id, quantity, notes)
        VALUES (?, ?, ?, ?)
      `).run(woId, sparePartId, quantity, notes || null);
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
    return res.status(501).json({ error: 'Table work_order_reservations absente. Exécutez les migrations.' });
  }
  const row = db.prepare(`
    SELECT r.*, sp.code as part_code, sp.name as part_name, sp.unit_price
    FROM work_order_reservations r JOIN spare_parts sp ON r.spare_part_id = sp.id
    WHERE r.work_order_id = ? AND r.spare_part_id = ?
  `).get(woId, sparePartId);
  const up = row.unit_price != null ? Number(row.unit_price) : 0;
  const lineCost = Math.round((row.quantity || 0) * up * 100) / 100;
  res.status(existing ? 200 : 201).json({
    id: row.id,
    workOrderId: row.work_order_id,
    sparePartId: row.spare_part_id,
    quantity: row.quantity,
    notes: row.notes,
    partCode: row.part_code,
    partName: row.part_name,
    unitPrice: up,
    lineCost,
    stockQuantity: available
  });
});

/**
 * DELETE /api/work-orders/:id/reservations/:reservationId
 */
router.delete('/:id/reservations/:reservationId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('reservationId').isInt(), (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM work_order_reservations WHERE id = ? AND work_order_id = ?').run(req.params.reservationId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Réservation non trouvée' });
  res.status(204).send();
});

/**
 * GET /api/work-orders/:id/consumed-parts — Pièces consommées sur l'OT
 */
router.get('/:id/consumed-parts', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT c.id, c.work_order_id, c.spare_part_id, c.quantity, c.unit_cost_at_use, c.created_at, c.created_by,
             sp.code as part_code, sp.name as part_name, sp.unit_price
      FROM work_order_consumed_parts c
      JOIN spare_parts sp ON c.spare_part_id = sp.id
      WHERE c.work_order_id = ?
      ORDER BY c.id
    `).all(req.params.id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  const out = rows.map((c) => {
    const unitCost = c.unit_cost_at_use != null ? Number(c.unit_cost_at_use) : (c.unit_price != null ? Number(c.unit_price) : 0);
    return {
      id: c.id,
      workOrderId: c.work_order_id,
      sparePartId: c.spare_part_id,
      partCode: c.part_code,
      partName: c.part_name,
      quantity: Number(c.quantity),
      unitCostAtUse: c.unit_cost_at_use != null ? Number(c.unit_cost_at_use) : null,
      unitPrice: c.unit_price != null ? Number(c.unit_price) : 0,
      lineCost: Math.round(Number(c.quantity) * unitCost * 100) / 100,
      createdAt: c.created_at,
      createdBy: c.created_by
    };
  });
  res.json(out);
});

/**
 * POST /api/work-orders/:id/consumed-parts — Enregistrer une pièce consommée (optionnel : mouvement de stock sortie)
 */
router.post('/:id/consumed-parts', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('sparePartId').isInt(),
  body('quantity').isFloat({ min: 0.01 }),
  body('unitCostAtUse').optional().isFloat({ min: 0 }),
  body('createStockExit').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const woId = parseInt(req.params.id, 10);
  const { sparePartId, quantity: qty, unitCostAtUse, createStockExit } = req.body;
  const quantity = parseFloat(qty);
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const part = db.prepare('SELECT id, code, name, unit_price FROM spare_parts WHERE id = ?').get(sparePartId);
  if (!part) return res.status(404).json({ error: 'Pièce non trouvée' });
  let available = 0;
  try {
    const bal = db.prepare('SELECT quantity_accepted, quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
    available = bal?.quantity_accepted ?? bal?.quantity ?? 0;
  } catch (_) {
    try {
      const bal = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
      available = bal?.quantity ?? 0;
    } catch (__) {}
  }
  if (createStockExit === true && available < quantity) {
    return res.status(400).json({
      error: `Stock insuffisant. Disponible : ${available}, demandé : ${quantity}. Enregistrez sans sortie stock ou réduisez la quantité.`
    });
  }
  const unitCost = unitCostAtUse != null ? parseFloat(unitCostAtUse) : (part.unit_price != null ? parseFloat(part.unit_price) : null);
  try {
    const r = db.prepare(`
      INSERT INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(woId, sparePartId, quantity, unitCost, req.user.id);
    const lineId = r.lastInsertRowid;
    if (createStockExit === true) {
      const qtyOut = quantity <= 0 ? 1 : Math.abs(quantity);
      try {
        db.prepare(`
          INSERT INTO stock_movements (spare_part_id, quantity, movement_type, work_order_id, user_id, notes)
          VALUES (?, ?, 'out', ?, ?, ?)
        `).run(sparePartId, -qtyOut, woId, req.user.id, `Consommation OT (ligne ${lineId})`);
      } catch (movErr) {
        if (!movErr.message || !movErr.message.includes('no such table')) console.warn('[workOrders] stock_movements:', movErr.message);
      }
    }
    const row = db.prepare(`
      SELECT c.id, c.work_order_id, c.spare_part_id, c.quantity, c.unit_cost_at_use, c.created_at,
             sp.code as part_code, sp.name as part_name, sp.unit_price
      FROM work_order_consumed_parts c
      JOIN spare_parts sp ON c.spare_part_id = sp.id
      WHERE c.id = ?
    `).get(lineId);
    const uc = row.unit_cost_at_use != null ? Number(row.unit_cost_at_use) : (row.unit_price != null ? Number(row.unit_price) : 0);
    res.status(201).json({
      id: row.id,
      workOrderId: row.work_order_id,
      sparePartId: row.spare_part_id,
      partCode: row.part_code,
      partName: row.part_name,
      quantity: Number(row.quantity),
      unitCostAtUse: row.unit_cost_at_use != null ? Number(row.unit_cost_at_use) : null,
      unitPrice: row.unit_price != null ? Number(row.unit_price) : 0,
      lineCost: Math.round(Number(row.quantity) * uc * 100) / 100,
      createdAt: row.created_at
    });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.status(501).json({ error: 'Table work_order_consumed_parts absente. Exécutez les migrations.' });
    }
    throw e;
  }
});

/**
 * DELETE /api/work-orders/:id/consumed-parts/:lineId
 */
router.delete('/:id/consumed-parts/:lineId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('lineId').isInt(), (req, res) => {
  const db = req.db;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  try {
    const result = db.prepare('DELETE FROM work_order_consumed_parts WHERE id = ? AND work_order_id = ?').run(req.params.lineId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Ligne pièce consommée non trouvée' });
    res.status(204).send();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_consumed_parts absente.' });
    throw e;
  }
});

/**
 * GET /api/work-orders/:id/operators — Liste des opérateurs affectés à l'OT
 */
router.get('/:id/operators', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let rows = [];
  try {
    rows = db.prepare('SELECT user_id FROM work_order_operators WHERE work_order_id = ?').all(req.params.id);
  } catch (_) {}
  const list = rows.map(r => {
    const u = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(r.user_id);
    return u ? { id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() } : null;
  }).filter(Boolean);
  res.json(list);
});

/**
 * POST /api/work-orders/:id/operators — Ajouter un opérateur à l'OT
 */
router.post('/:id/operators', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), body('userId').isInt(), (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const woId = req.params.id;
  const userId = parseInt(req.body.userId, 10);
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const us = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(userId);
  if (!us) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  try {
    db.prepare('INSERT INTO work_order_operators (work_order_id, user_id) VALUES (?, ?)').run(woId, userId);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cet opérateur est déjà affecté à cet OT.' });
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_operators absente. Exécutez les migrations.' });
    throw e;
  }
  res.status(201).json({ id: us.id, firstName: us.first_name, lastName: us.last_name, name: `${us.first_name || ''} ${us.last_name || ''}`.trim() });
});

/**
 * DELETE /api/work-orders/:id/operators/:userId — Retirer un opérateur de l'OT
 */
router.delete('/:id/operators/:userId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('userId').isInt(), (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM work_order_operators WHERE work_order_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Opérateur non trouvé ou non affecté à cet OT' });
  const wo = db.prepare('SELECT assigned_to FROM work_orders WHERE id = ?').get(req.params.id);
  if (wo && wo.assigned_to === parseInt(req.params.userId, 10)) {
    const first = db.prepare('SELECT user_id FROM work_order_operators WHERE work_order_id = ? LIMIT 1').get(req.params.id);
    db.prepare('UPDATE work_orders SET assigned_to = ? WHERE id = ?').run(first ? first.user_id : null, req.params.id);
  }
  res.status(204).send();
});

/**
 * GET /api/work-orders/:id/tool-assignments — Outils affectés à cet OT (non retournés)
 */
router.get('/:id/tool-assignments', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT ta.id as assignmentId, ta.tool_id as toolId, ta.assigned_to, ta.assigned_at,
             t.code as tool_code, t.name as tool_name,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM tool_assignments ta
      LEFT JOIN tools t ON ta.tool_id = t.id
      LEFT JOIN users u ON ta.assigned_to = u.id
      WHERE ta.work_order_id = ? AND ta.returned_at IS NULL
      ORDER BY ta.assigned_at DESC
    `).all(req.params.id);
  } catch (_) {}
  res.json(rows.map(r => ({
    assignmentId: r.assignmentId,
    toolId: r.toolId,
    toolCode: r.tool_code,
    toolName: r.tool_name,
    assignedTo: r.assigned_to,
    assignedToName: r.assigned_to_name,
    assignedAt: r.assigned_at
  })));
});

/**
 * GET /api/work-orders/:id/checklist-executions — Exécutions de checklists liées à cet OT
 */
router.get('/:id/checklist-executions', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const woId = req.params.id;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT ce.id, ce.checklist_id, ce.work_order_id, ce.executed_by, ce.executed_at, ce.notes,
             c.name as checklist_name,
             u.first_name || ' ' || u.last_name as executed_by_name
      FROM checklist_executions ce
      LEFT JOIN maintenance_checklists c ON ce.checklist_id = c.id
      LEFT JOIN users u ON ce.executed_by = u.id
      WHERE ce.work_order_id = ?
      ORDER BY ce.executed_at DESC
    `).all(woId);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  res.json(rows.map(r => ({
    id: r.id,
    checklistId: r.checklist_id,
    checklistName: r.checklist_name,
    workOrderId: r.work_order_id,
    executedBy: r.executed_by,
    executedByName: r.executed_by_name,
    executedAt: r.executed_at,
    notes: r.notes
  })));
});

/**
 * GET /api/work-orders/:id/phase-times
 */
router.get('/:id/phase-times', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  try {
    const rows = db.prepare('SELECT * FROM work_order_phase_times WHERE work_order_id = ? ORDER BY phase_name').all(req.params.id);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

/**
 * POST /api/work-orders/:id/phase-times
 */
router.post('/:id/phase-times', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('phaseName').notEmpty().trim(),
  body('hoursSpent').optional().isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { phaseName, hoursSpent, notes } = req.body;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO work_order_phase_times (work_order_id, phase_name, hours_spent, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, phaseName, hoursSpent != null ? Number(hoursSpent) : 0, notes || null);
    const row = db.prepare('SELECT * FROM work_order_phase_times WHERE work_order_id = ? AND phase_name = ?').get(req.params.id, phaseName);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_phase_times non disponible' });
    throw e;
  }
});

/**
 * PUT /api/work-orders/:id/phase-times — Mise à jour en masse (diagnostic, réparation, essai)
 * Body: { phases: [{ phaseName, hoursSpent, notes? }, ...] }
 */
router.put('/:id/phase-times', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), (req, res) => {
  const db = req.db;
  const woId = req.params.id;
  if (!db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId)) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const phases = Array.isArray(req.body.phases) ? req.body.phases : [];
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO work_order_phase_times (work_order_id, phase_name, hours_spent, notes) VALUES (?, ?, ?, ?)
    `);
    for (const p of phases) {
      const name = (p.phaseName || p.phase_name || '').trim();
      if (!name) continue;
      stmt.run(woId, name, Math.max(0, parseFloat(p.hoursSpent ?? p.hours_spent) || 0), p.notes || null);
    }
    const rows = db.prepare('SELECT id, phase_name, hours_spent, notes FROM work_order_phase_times WHERE work_order_id = ? ORDER BY phase_name').all(woId);
    res.json(rows.map((r) => ({ id: r.id, phaseName: r.phase_name, hoursSpent: Number(r.hours_spent), notes: r.notes })));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_phase_times non disponible' });
    throw e;
  }
});

/**
 * GET /api/work-orders/:id/attachments
 */
router.get('/:id/attachments', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM work_order_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.work_order_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

/**
 * POST /api/work-orders/:id/attachments
 */
router.post('/:id/attachments', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), woUpload.single('file'), (req, res) => {
  const db = req.db;
  if (!req.file || !req.file.path) return res.status(400).json({ error: 'Aucun fichier envoyé' });
  const attachmentType = (req.body && req.body.attachmentType) || 'document';
  try {
    const r = db.prepare(`
      INSERT INTO work_order_attachments (work_order_id, file_name, file_path, file_size, mime_type, attachment_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, req.file.originalname || req.file.filename, req.file.path, req.file.size || 0, req.file.mimetype || null, attachmentType, req.user.id);
    const row = db.prepare('SELECT * FROM work_order_attachments WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table work_order_attachments non disponible' });
    throw e;
  }
});

/**
 * DELETE /api/work-orders/:id/attachments/:attId
 */
router.delete('/:id/attachments/:attId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('attId').isInt(), (req, res) => {
  const db = req.db;
  const att = db.prepare('SELECT * FROM work_order_attachments WHERE id = ? AND work_order_id = ?').get(req.params.attId, req.params.id);
  if (!att) return res.status(404).json({ error: 'Pièce jointe non trouvée' });
  try {
    if (att.file_path && fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path);
  } catch (_) {}
  db.prepare('DELETE FROM work_order_attachments WHERE id = ?').run(req.params.attId);
  res.status(204).send();
});

/**
 * GET /api/work-orders/:id/extra-fees — liste des frais supplémentaires de l'OT
 */
router.get('/:id/extra-fees', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  if (!db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'OT non trouvé' });
  try {
    const rows = db.prepare('SELECT id, work_order_id, description, amount, created_at FROM work_order_extra_fees WHERE work_order_id = ? ORDER BY id').all(req.params.id);
    res.json(rows.map((r) => ({ id: r.id, workOrderId: r.work_order_id, description: r.description || '', amount: Number(r.amount), createdAt: r.created_at })));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

/**
 * POST /api/work-orders/:id/extra-fees — ajouter un frais supplémentaire
 */
router.post('/:id/extra-fees', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('description').optional().trim(),
  body('amount').isFloat({ min: 0 }).withMessage('Montant invalide')
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (!db.prepare('SELECT id FROM work_orders WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'OT non trouvé' });
  const { description = '', amount } = req.body;
  try {
    const r = db.prepare('INSERT INTO work_order_extra_fees (work_order_id, description, amount) VALUES (?, ?, ?)').run(req.params.id, description, Number(amount));
    const row = db.prepare('SELECT id, work_order_id, description, amount, created_at FROM work_order_extra_fees WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json({ id: row.id, workOrderId: row.work_order_id, description: row.description || '', amount: Number(row.amount), createdAt: row.created_at });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table frais supplémentaires non disponible' });
    throw e;
  }
});

/**
 * PUT /api/work-orders/:id/extra-fees/:feeId — modifier un frais
 */
router.put('/:id/extra-fees/:feeId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('feeId').isInt(), [
  body('description').optional().trim(),
  body('amount').optional().isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const existing = db.prepare('SELECT id FROM work_order_extra_fees WHERE id = ? AND work_order_id = ?').get(req.params.feeId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Frais non trouvé' });
  const { description, amount } = req.body;
  const updates = [];
  const params = [];
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (amount !== undefined) { updates.push('amount = ?'); params.push(Number(amount)); }
  if (updates.length === 0) {
    const row = db.prepare('SELECT id, work_order_id, description, amount, created_at FROM work_order_extra_fees WHERE id = ?').get(req.params.feeId);
    return res.json({ id: row.id, workOrderId: row.work_order_id, description: row.description || '', amount: Number(row.amount), createdAt: row.created_at });
  }
  params.push(req.params.feeId);
  db.prepare(`UPDATE work_order_extra_fees SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT id, work_order_id, description, amount, created_at FROM work_order_extra_fees WHERE id = ?').get(req.params.feeId);
  res.json({ id: row.id, workOrderId: row.work_order_id, description: row.description || '', amount: Number(row.amount), createdAt: row.created_at });
});

/**
 * DELETE /api/work-orders/:id/extra-fees/:feeId
 */
router.delete('/:id/extra-fees/:feeId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('feeId').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM work_order_extra_fees WHERE id = ? AND work_order_id = ?').run(req.params.feeId, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Frais non trouvé' });
  res.status(204).send();
});

/**
 * GET /api/work-orders/:id
 */
router.get('/:id', requirePermission('work_orders', 'view'), param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const row = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name,
           cb.first_name || ' ' || cb.last_name as created_by_name,
           mp.name as maintenance_plan_name,
           pr.name as project_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    LEFT JOIN users cb ON wo.created_by = cb.id
    LEFT JOIN maintenance_plans mp ON wo.maintenance_plan_id = mp.id
    LEFT JOIN maintenance_projects pr ON wo.project_id = pr.id
    WHERE wo.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  let procedureIds = [];
  try {
    const wop = db.prepare('SELECT procedure_id FROM work_order_procedures WHERE work_order_id = ?').all(req.params.id);
    procedureIds = (wop || []).map(r => r.procedure_id);
  } catch (_) {
    procedureIds = [];
  }
  if (procedureIds.length === 0 && row.procedure_id) procedureIds = [row.procedure_id];
  if (procedureIds.length === 0 && row.maintenance_plan_id) {
    const plan = db.prepare('SELECT procedure_id FROM maintenance_plans WHERE id = ?').get(row.maintenance_plan_id);
    if (plan?.procedure_id) procedureIds = [plan.procedure_id];
  }
  const procedureId = procedureIds[0] || row.procedure_id;
  if (procedureId) {
    const proc = db.prepare('SELECT id, name, description, steps, safety_notes FROM procedures WHERE id = ?').get(procedureId);
    if (proc) {
      row.procedure_id = proc.id;
      row.procedure_name = proc.name;
      row.procedure_description = proc.description;
      row.procedure_steps = proc.steps;
      row.procedure_safety_notes = proc.safety_notes;
    }
  }
  const costs = getWorkOrderCosts(db, req.params.id);
  const out = formatWO(row, costs);
  if (row.project_name !== undefined) out.projectName = row.project_name;
  out.assignedProcedureIds = procedureIds;
  const proceduresList = [];
  for (const pid of procedureIds) {
    const p = db.prepare('SELECT id, name, description, steps, safety_notes FROM procedures WHERE id = ?').get(pid);
    if (p) proceduresList.push(p);
  }
  if (proceduresList.length) out.procedures = proceduresList;
  try {
    const woc = db.prepare('SELECT checklist_id FROM work_order_checklists WHERE work_order_id = ?').all(req.params.id);
    out.assignedChecklistIds = (woc || []).map(r => r.checklist_id);
  } catch (_) {
    out.assignedChecklistIds = [];
  }
  try {
    const woo = db.prepare('SELECT user_id FROM work_order_operators WHERE work_order_id = ?').all(req.params.id);
    out.assignedOperatorIds = (woo || []).map(r => r.user_id);
    out.assignedOperators = out.assignedOperatorIds.map(uid => {
      const u = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(uid);
      return u ? { id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() } : null;
    }).filter(Boolean);
  } catch (_) {
    out.assignedOperatorIds = [];
    out.assignedOperators = [];
  }
  try {
    const fees = db.prepare('SELECT id, description, amount, created_at FROM work_order_extra_fees WHERE work_order_id = ? ORDER BY id').all(req.params.id);
    out.extraFees = (fees || []).map((f) => ({ id: f.id, description: f.description || '', amount: Number(f.amount), createdAt: f.created_at }));
  } catch (_) {
    out.extraFees = [];
  }
  try {
    const consumed = db.prepare(`
      SELECT c.id, c.work_order_id, c.spare_part_id, c.quantity, c.unit_cost_at_use, c.created_at,
             sp.code as part_code, sp.name as part_name, sp.unit_price
      FROM work_order_consumed_parts c
      JOIN spare_parts sp ON c.spare_part_id = sp.id
      WHERE c.work_order_id = ?
      ORDER BY c.id
    `).all(req.params.id);
    out.consumedParts = (consumed || []).map((c) => {
      const unitCost = c.unit_cost_at_use != null ? Number(c.unit_cost_at_use) : (c.unit_price != null ? Number(c.unit_price) : 0);
      return {
        id: c.id,
        workOrderId: c.work_order_id,
        sparePartId: c.spare_part_id,
        partCode: c.part_code,
        partName: c.part_name,
        quantity: Number(c.quantity),
        unitCostAtUse: c.unit_cost_at_use != null ? Number(c.unit_cost_at_use) : null,
        unitPrice: c.unit_price != null ? Number(c.unit_price) : 0,
        lineCost: Math.round(Number(c.quantity) * unitCost * 100) / 100,
        createdAt: c.created_at
      };
    });
  } catch (_) {
    out.consumedParts = [];
  }
  try {
    const phaseRows = db.prepare('SELECT id, phase_name, hours_spent, notes FROM work_order_phase_times WHERE work_order_id = ? ORDER BY phase_name').all(req.params.id);
    out.phaseTimes = (phaseRows || []).map((p) => ({ id: p.id, phaseName: p.phase_name, hoursSpent: Number(p.hours_spent), notes: p.notes }));
  } catch (_) {
    out.phaseTimes = [];
  }
  res.json(out);
});

/**
 * POST /api/work-orders
 * Création OT (déclaration panne ou planifié)
 */
router.post('/', requirePermission('work_orders', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN, ROLES.UTILISATEUR), [
  body('title').notEmpty().trim(),
  body('equipmentId').optional().isInt(),
  body('typeId').optional().isInt(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('description').optional()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, description, equipmentId, typeId, priority, assignedTo, plannedStart, plannedEnd, maintenancePlanId, procedureId: bodyProcedureId } = req.body;
  if (equipmentId != null) {
    const eq = db.prepare('SELECT id, status FROM equipment WHERE id = ?').get(parseInt(equipmentId, 10));
    if (eq && ['out_of_service', 'retired'].includes(eq.status)) {
      return res.status(400).json({
        error: `L'équipement est en statut « ${eq.status === 'retired' ? 'réformé' : 'hors service' } ». Création d'OT non autorisée.`
      });
    }
  }
  const number = generateOTNumber(db);
  const failureDate = req.body.failureDate || (req.body.typeId === 2 ? new Date().toISOString() : null);
  const SLA_HOURS = { critical: 2, high: 8, medium: 24, low: 72 };
  const prio = priority || 'medium';
  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + (SLA_HOURS[prio] || 24));
  const projectId = req.body.projectId || null;
  let assignedUserIds = Array.isArray(req.body.assignedUserIds) ? req.body.assignedUserIds.map(id => parseInt(id, 10)).filter(Boolean) : [];
  if (assignedUserIds.length === 0 && assignedTo) assignedUserIds = [parseInt(assignedTo, 10)];
  const primaryAssignedTo = assignedUserIds[0] || assignedTo || null;
  let procedureIds = Array.isArray(req.body.procedureIds) ? req.body.procedureIds.map(id => parseInt(id, 10)).filter(Boolean) : [];
  if (procedureIds.length === 0 && bodyProcedureId != null) procedureIds = [parseInt(bodyProcedureId, 10)];
  if (procedureIds.length === 0 && maintenancePlanId) {
    const plan = db.prepare('SELECT procedure_id FROM maintenance_plans WHERE id = ?').get(parseInt(maintenancePlanId, 10));
    if (plan?.procedure_id) procedureIds = [plan.procedure_id];
  }
  const procedureId = procedureIds[0] || null;
  try {
    const hasProcedureCol = (() => { try { db.prepare('SELECT procedure_id FROM work_orders LIMIT 1').get(); return true; } catch (_) { return false; } })();
    let insertResult;
    if (hasProcedureCol) {
      insertResult = db.prepare(`
        INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, assigned_to, planned_start, planned_end, maintenance_plan_id, procedure_id, failure_date, created_by, sla_deadline, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(number, title, description || null, equipmentId || null, typeId || 2, priority || 'medium',
        primaryAssignedTo, plannedStart || null, plannedEnd || null, maintenancePlanId || null, procedureId, failureDate, req.user.id, slaDeadline.toISOString(), projectId);
    } else {
      insertResult = db.prepare(`
        INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, assigned_to, planned_start, planned_end, maintenance_plan_id, failure_date, created_by, sla_deadline, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(number, title, description || null, equipmentId || null, typeId || 2, priority || 'medium',
        primaryAssignedTo, plannedStart || null, plannedEnd || null, maintenancePlanId || null, failureDate, req.user.id, slaDeadline.toISOString(), projectId);
    }
    const woId = insertResult.lastInsertRowid;
    const row = db.prepare(`
      SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
             u.first_name || ' ' || u.last_name as assigned_name
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN work_order_types t ON wo.type_id = t.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      WHERE wo.id = ?
    `).get(woId);

    // Notifier les utilisateurs maintenance (technicien, responsable, admin) de la nouvelle panne
    try {
      const maintenanceUsers = db.prepare(`
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance', 'administrateur')
      `).all();
      const equipmentLabel = row.equipment_name ? `${row.equipment_code || ''} ${row.equipment_name}`.trim() : 'Non renseigné';
      const title = `Nouvelle panne déclarée : ${number}`;
      const message = `${row.title}${equipmentLabel !== 'Non renseigné' ? ' - ' + equipmentLabel : ''}`;
      for (const u of maintenanceUsers) {
        if (u.id === req.user.id) continue;
        db.prepare(`
          INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_user_id)
          VALUES ('equipment_failure', 'warning', ?, ?, 'work_order', ?, ?)
        `).run(title, message, woId, u.id);
      }
    } catch (alertErr) {
      if (!alertErr.message || !alertErr.message.includes('no such table')) console.warn('[workOrders] Alerts:', alertErr.message);
    }

    const maintenanceUserIds = getUsersByRole(db, req.tenantId, ['technicien', 'responsable_maintenance', 'administrateur'])
      .filter((id) => id !== req.user.id);
    notificationService.notify(db, 'work_order_created', maintenanceUserIds, {
      number: row.number,
      title: row.title,
      equipment_name: row.equipment_name ? `${row.equipment_code || ''} ${row.equipment_name}`.trim() : null,
      priority: row.priority
    }, req.tenantId).catch(() => {});

    // Réservations pièces (création)
    const reservations = Array.isArray(req.body.reservations) ? req.body.reservations : [];
    for (const r of reservations) {
      const sparePartId = r.sparePartId != null ? parseInt(r.sparePartId, 10) : null;
      const quantity = r.quantity != null ? parseInt(r.quantity, 10) : 0;
      if (!sparePartId || quantity < 1) continue;
      const part = db.prepare('SELECT id FROM spare_parts WHERE id = ?').get(sparePartId);
      if (!part) continue;
      let available = 0;
      try {
        const bal = db.prepare('SELECT quantity_accepted, quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
        available = bal?.quantity_accepted ?? bal?.quantity ?? 0;
      } catch (_) {
        const bal = db.prepare('SELECT quantity FROM stock_balance WHERE spare_part_id = ?').get(sparePartId);
        available = bal?.quantity ?? 0;
      }
      if (available < quantity) continue; // skip cette ligne si stock insuffisant
      try {
        db.prepare(`
          INSERT INTO work_order_reservations (work_order_id, spare_part_id, quantity, notes)
          VALUES (?, ?, ?, ?)
        `).run(woId, sparePartId, quantity, r.notes || null);
      } catch (er) {
        if (!er.message || !er.message.includes('no such table')) { /* ignore doublon UNIQUE */ }
      }
    }

    // Opérateurs / équipe (création)
    try {
      const insOp = db.prepare('INSERT INTO work_order_operators (work_order_id, user_id) VALUES (?, ?)');
      for (const uid of assignedUserIds) {
        if (!uid) continue;
        const us = db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
        if (us) insOp.run(woId, uid);
      }
    } catch (err) {
      if (!err.message || !err.message.includes('no such table')) { /* work_order_operators non migré */ }
    }

    // Outils assignés à l'OT (création)
    const toolIds = Array.isArray(req.body.toolIds) ? req.body.toolIds : [];
    const assigneeId = primaryAssignedTo || req.user.id;
    for (const tid of toolIds) {
      const toolId = parseInt(tid, 10);
      if (!toolId) continue;
      const tool = db.prepare('SELECT id, status FROM tools WHERE id = ?').get(toolId);
      if (!tool || tool.status !== 'available') continue;
      try {
        db.prepare(`
          INSERT INTO tool_assignments (tool_id, work_order_id, assigned_to, notes)
          VALUES (?, ?, ?, ?)
        `).run(toolId, woId, assigneeId, null);
        db.prepare('UPDATE tools SET status = ? WHERE id = ?').run('in_use', toolId);
      } catch (err) {
        if (!err.message || !err.message.includes('no such table')) { /* ignore */ }
      }
    }

    // Checklists affectées à l'OT (création)
    const checklistIds = Array.isArray(req.body.checklistIds) ? req.body.checklistIds : [];
    try {
      const insChecklist = db.prepare('INSERT INTO work_order_checklists (work_order_id, checklist_id) VALUES (?, ?)');
      for (const cid of checklistIds) {
        const checklistId = parseInt(cid, 10);
        if (!checklistId) continue;
        const c = db.prepare('SELECT id FROM maintenance_checklists WHERE id = ?').get(checklistId);
        if (c) insChecklist.run(woId, checklistId);
      }
    } catch (err) {
      if (!err.message || !err.message.includes('no such table')) { /* work_order_checklists non migré */ }
    }

    // Procédures affectées à l'OT (création)
    try {
      const insProc = db.prepare('INSERT INTO work_order_procedures (work_order_id, procedure_id) VALUES (?, ?)');
      for (const pid of procedureIds) {
        if (!pid) continue;
        const proc = db.prepare('SELECT id FROM procedures WHERE id = ?').get(pid);
        if (proc) insProc.run(woId, pid);
      }
    } catch (err) {
      if (!err.message || !err.message.includes('no such table')) { /* work_order_procedures non migré */ }
    }

    // Workflow : brouillon si demandé
    if (req.body.statusWorkflow === 'draft') {
      try {
        db.prepare('UPDATE work_orders SET status_workflow = ? WHERE id = ?').run('draft', woId);
        row.status_workflow = 'draft';
      } catch (_) {}
    }
    auditService.log(db, 'work_order', woId, 'created', { userId: req.user?.id, userEmail: req.user?.email, summary: row.number });
    res.status(201).json(formatWO(row));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Numéro OT déjà existant' });
    throw e;
  }
});

/**
 * PUT /api/work-orders/:id
 * Technicien : peut passer en cours, actual_start, actual_end. Clôture (completed) réservée au responsable ou admin.
 */
router.put('/:id', requirePermission('work_orders', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  param('id').isInt(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled', 'deferred']),
  body('statusWorkflow').optional().isIn(['draft', 'planned', 'in_progress', 'to_validate', 'pending_approval', 'closed'])
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (req.body.status === 'completed') {
    const canClose = [ROLES.ADMIN, ROLES.RESPONSABLE].includes(req.user.role_name);
    if (!canClose) return res.status(403).json({ error: 'Seul un responsable ou un administrateur peut clôturer l\'OT.' });
  }
  if (req.body.statusWorkflow === 'closed') {
    const canClose = [ROLES.ADMIN, ROLES.RESPONSABLE].includes(req.user.role_name);
    if (!canClose) return res.status(403).json({ error: 'Seul un responsable ou un administrateur peut clôturer l\'OT.' });
  }
  const id = req.params.id;
  const existing = db.prepare('SELECT id, status, status_workflow, project_id FROM work_orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  if (req.body.equipmentId != null) {
    const eq = db.prepare('SELECT id, status FROM equipment WHERE id = ?').get(parseInt(req.body.equipmentId, 10));
    if (eq && ['out_of_service', 'retired'].includes(eq.status)) {
      return res.status(400).json({
        error: `L'équipement est en statut « ${eq.status === 'retired' ? 'réformé' : 'hors service' } ». Affectation non autorisée.`
      });
    }
  }
  const hasProcedureCol = (() => { try { db.prepare('SELECT procedure_id FROM work_orders LIMIT 1').get(); return true; } catch (_) { return false; } })();
  const hasStatusWorkflowCol = (() => { try { db.prepare('SELECT status_workflow FROM work_orders LIMIT 1').get(); return true; } catch (_) { return false; } })();
  const fields = ['title', 'description', 'equipment_id', 'type_id', 'priority', 'status', 'assigned_to', 'planned_start', 'planned_end', 'actual_start', 'actual_end', 'completed_by', 'completed_at', 'signature_name', 'project_id'].concat(hasProcedureCol ? ['procedure_id'] : []);
  const mapping = { equipmentId: 'equipment_id', typeId: 'type_id', assignedTo: 'assigned_to', plannedStart: 'planned_start', plannedEnd: 'planned_end', actualStart: 'actual_start', actualEnd: 'actual_end', completedBy: 'completed_by', completedAt: 'completed_at', signatureName: 'signature_name', projectId: 'project_id', procedureId: 'procedure_id' };
  const updates = [];
  const values = [];
  let approvalThreshold = 0;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('approval_threshold_amount');
    if (r?.value != null) approvalThreshold = parseFloat(r.value) || 0;
  } catch (_) {}
  // Transitions workflow → status
  if (req.body.statusWorkflow === 'planned') {
    req.body.status = req.body.status || 'pending';
    if (hasStatusWorkflowCol) { updates.push('status_workflow = ?'); values.push('planned'); }
  } else if (req.body.statusWorkflow === 'in_progress') {
    req.body.status = 'in_progress';
    if (hasStatusWorkflowCol) { updates.push('status_workflow = ?'); values.push('in_progress'); }
    if (req.body.actualStart === undefined) req.body.actualStart = new Date().toISOString().slice(0, 19);
  } else if (req.body.statusWorkflow === 'to_validate' && hasStatusWorkflowCol) {
    updates.push('status_workflow = ?');
    values.push('to_validate');
  } else if (req.body.statusWorkflow === 'closed') {
    if (approvalThreshold > 0 && hasStatusWorkflowCol) {
      const costs = getWorkOrderCosts(db, id);
      if (costs && costs.totalCost >= approvalThreshold) {
        updates.push('status_workflow = ?');
        values.push('pending_approval');
        if (req.body.status === 'completed') {
          delete req.body.status;
          req.body.completedAt = undefined;
          req.body.completedBy = undefined;
          req.body.signatureName = undefined;
        }
      } else {
        req.body.status = 'completed';
        if (hasStatusWorkflowCol) { updates.push('status_workflow = ?'); values.push('closed'); }
      }
    } else {
      req.body.status = 'completed';
      if (hasStatusWorkflowCol) { updates.push('status_workflow = ?'); values.push('closed'); }
    }
  } else if (req.body.statusWorkflow === 'draft' && hasStatusWorkflowCol) {
    updates.push('status_workflow = ?');
    values.push('draft');
  } else if (req.body.statusWorkflow === 'pending_approval' && hasStatusWorkflowCol) {
    updates.push('status_workflow = ?');
    values.push('pending_approval');
  }
  if (req.body.status === 'completed') {
    updates.push('completed_at = ?');
    values.push(new Date().toISOString().slice(0, 19));
    // Ne jamais faire confiance au frontend : completed_by = utilisateur qui clôture
    updates.push('completed_by = ?');
    values.push(req.user.id);
    if (req.body.signatureName != null && String(req.body.signatureName).trim()) {
      updates.push('signature_name = ?');
      values.push(String(req.body.signatureName).trim());
    }
  }
  for (const [key, val] of Object.entries(req.body)) {
    const col = mapping[key] || key;
    if (fields.includes(col) && val !== undefined && !['completed_by', 'completed_at', 'signature_name'].includes(col)) {
      updates.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  const previous = db.prepare('SELECT assigned_to, status FROM work_orders WHERE id = ?').get(id);
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  db.prepare(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (Array.isArray(req.body.procedureIds)) {
    try {
      db.prepare('DELETE FROM work_order_procedures WHERE work_order_id = ?').run(id);
      const procedureIds = req.body.procedureIds.map(pid => parseInt(pid, 10)).filter(Boolean);
      const insProc = db.prepare('INSERT INTO work_order_procedures (work_order_id, procedure_id) VALUES (?, ?)');
      for (const pid of procedureIds) {
        const proc = db.prepare('SELECT id FROM procedures WHERE id = ?').get(pid);
        if (proc) insProc.run(id, pid);
      }
      if (procedureIds.length && hasProcedureCol) {
        db.prepare('UPDATE work_orders SET procedure_id = ? WHERE id = ?').run(procedureIds[0], id);
      }
    } catch (err) {
      if (!err.message || !err.message.includes('no such table')) { /* ignore */ }
    }
  }

  const row = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.id = ?
  `).get(id);
  let procId = row.procedure_id;
  try {
    const wop = db.prepare('SELECT procedure_id FROM work_order_procedures WHERE work_order_id = ?').all(id);
    if (wop && wop.length) procId = wop[0].procedure_id;
  } catch (_) {}
  if (!procId && row.maintenance_plan_id) {
    const plan = db.prepare('SELECT procedure_id FROM maintenance_plans WHERE id = ?').get(row.maintenance_plan_id);
    procId = plan?.procedure_id;
  }
  if (procId) {
    const proc = db.prepare('SELECT id, name, description, steps, safety_notes FROM procedures WHERE id = ?').get(procId);
    if (proc) {
      row.procedure_name = proc.name;
      row.procedure_description = proc.description;
      row.procedure_steps = proc.steps;
      row.procedure_safety_notes = proc.safety_notes;
    }
  }

  const newAssigned = req.body.assignedTo != null ? parseInt(req.body.assignedTo, 10) : null;
  const newStatus = req.body.status;
  if (previous && newAssigned !== undefined && previous.assigned_to !== newAssigned && newAssigned) {
    notificationService.notify(db, 'work_order_assigned', [newAssigned], {
      number: row.number,
      title: row.title
    }, req.tenantId).catch(() => {});
  }
  if (previous && newStatus === 'completed' && previous.status !== 'completed') {
    const responsibles = getUsersByRole(db, req.tenantId, ['responsable_maintenance', 'administrateur']);
    notificationService.notify(db, 'work_order_closed', responsibles, {
      number: row.number,
      title: row.title
    }, req.tenantId).catch(() => {});
    if (row.project_id) {
      try {
        const budgetsRoute = require('./budgets');
        const budgetRow = db.prepare('SELECT id, amount, name FROM maintenance_budgets WHERE project_id = ?').get(row.project_id);
        if (budgetRow && typeof budgetsRoute.checkBudgetOverrun === 'function' && typeof budgetsRoute.getProjectCurrentCost === 'function') {
          const currentCost = budgetsRoute.getProjectCurrentCost(db, row.project_id);
          budgetsRoute.checkBudgetOverrun(db, budgetRow.id, currentCost, budgetRow.amount, budgetRow.name, req.tenantId);
        }
      } catch (_) {}
    }
  }

  auditService.log(db, 'work_order', id, 'updated', { userId: req.user?.id, userEmail: req.user?.email, summary: row.number });
  res.json(formatWO(row));
});

/**
 * PUT /api/work-orders/:id/approve — Approuver un OT en attente (coût >= seuil)
 * Réservé aux responsables et administrateurs.
 */
router.put('/:id/approve', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const wo = db.prepare('SELECT id, status_workflow, project_id, number, title FROM work_orders WHERE id = ?').get(id);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const hasStatusWorkflowCol = (() => { try { db.prepare('SELECT status_workflow FROM work_orders LIMIT 1').get(); return true; } catch (_) { return false; } })();
  if (!hasStatusWorkflowCol || wo.status_workflow !== 'pending_approval') {
    return res.status(400).json({ error: 'Cet OT n\'est pas en attente d\'approbation.' });
  }
  const now = new Date().toISOString().slice(0, 19);
  try {
    db.prepare(`
      UPDATE work_orders SET status = 'completed', status_workflow = 'closed',
        completed_at = ?, completed_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(now, req.user.id, id);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.prepare(`UPDATE work_orders SET status = 'completed', completed_at = ?, completed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(now, req.user.id, id);
      if (hasStatusWorkflowCol) db.prepare('UPDATE work_orders SET status_workflow = ? WHERE id = ?').run('closed', id);
    } else throw e;
  }
  if (wo.project_id) {
    try {
      const budgetsRoute = require('./budgets');
      if (typeof budgetsRoute.checkBudgetOverrun === 'function') {
        const budgetRow = db.prepare('SELECT id, amount, name FROM maintenance_budgets WHERE project_id = ?').get(wo.project_id);
        if (budgetRow) {
          const currentCost = typeof budgetsRoute.getProjectCurrentCost === 'function' ? budgetsRoute.getProjectCurrentCost(db, wo.project_id) : 0;
          budgetsRoute.checkBudgetOverrun(db, budgetRow.id, currentCost, budgetRow.amount, budgetRow.name, req.tenantId);
        }
      }
    } catch (_) {}
  }
  const responsibles = getUsersByRole(db, req.tenantId, ['responsable_maintenance', 'administrateur']);
  notificationService.notify(db, 'work_order_closed', responsibles, { number: wo.number, title: wo.title }, req.tenantId).catch(() => {});
  auditService.log(db, 'work_order', id, 'approved', { userId: req.user?.id, userEmail: req.user?.email, summary: wo.number });
  const row = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.id = ?
  `).get(id);
  const costs = getWorkOrderCosts(db, id);
  res.json(formatWO(row, costs));
});

/**
 * DELETE /api/work-orders/:id (annulation)
 */
router.delete('/:id', requirePermission('work_orders', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const wo = db.prepare('SELECT number FROM work_orders WHERE id = ?').get(id);
  const result = db.prepare("UPDATE work_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  auditService.log(db, 'work_order', id, 'deleted', { userId: req.user?.id, userEmail: req.user?.email, summary: wo?.number });
  res.status(204).send();
});

router.getWorkOrderCosts = getWorkOrderCosts;
module.exports = router;
