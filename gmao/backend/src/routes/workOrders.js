/**
 * API Ordres de travail - Maintenance corrective et préventive
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

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
    out.totalCost = costs.totalCost;
  }
  return out;
}

function getWorkOrderCosts(woId) {
  const parts = db.prepare(`
    SELECT COALESCE(SUM(i.quantity_used * sp.unit_price), 0) as parts_cost
    FROM interventions i
    LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
    WHERE i.work_order_id = ?
  `).get(woId);
  const labor = db.prepare(`
    SELECT COALESCE(SUM(i.hours_spent * u.hourly_rate), 0) as labor_cost
    FROM interventions i
    LEFT JOIN users u ON i.technician_id = u.id
    WHERE i.work_order_id = ?
  `).get(woId);
  const wo = db.prepare('SELECT actual_start, actual_end, assigned_to FROM work_orders WHERE id = ?').get(woId);
  let laborCost = (labor && labor.labor_cost) ? labor.labor_cost : 0;
  if (wo && wo.actual_start && wo.actual_end && laborCost === 0 && wo.assigned_to) {
    const rate = db.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(wo.assigned_to);
    const hours = (new Date(wo.actual_end) - new Date(wo.actual_start)) / (1000 * 60 * 60);
    laborCost = hours * (rate?.hourly_rate || 0);
  }
  const partsCost = (parts && parts.parts_cost) ? parts.parts_cost : 0;
  return { laborCost, partsCost, totalCost: laborCost + partsCost };
}

/**
 * Génère un numéro d'OT unique
 */
function generateOTNumber() {
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
router.get('/', (req, res) => {
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
router.get('/types', (req, res) => {
  const types = db.prepare('SELECT * FROM work_order_types ORDER BY name').all();
  res.json(types);
});

/**
 * GET /api/work-orders/calendar
 * OT pour affichage calendrier
 */
router.get('/calendar', (req, res) => {
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
router.get('/:id/reservations', param('id').isInt(), (req, res) => {
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
  res.json(rows.map(r => ({
    id: r.id,
    workOrderId: r.work_order_id,
    sparePartId: r.spare_part_id,
    quantity: r.quantity,
    notes: r.notes,
    createdAt: r.created_at,
    partCode: r.part_code,
    partName: r.part_name,
    unitPrice: r.unit_price,
    stockQuantity: r.stock_quantity
  })));
});

/**
 * POST /api/work-orders/:id/reservations — Réserver des pièces pour l'OT
 */
router.post('/:id/reservations', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('sparePartId').isInt(),
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const woId = req.params.id;
  const { sparePartId, quantity, notes } = req.body;
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const part = db.prepare('SELECT id, code, name FROM spare_parts WHERE id = ?').get(sparePartId);
  if (!part) return res.status(404).json({ error: 'Pièce non trouvée' });
  try {
    db.prepare(`
      INSERT INTO work_order_reservations (work_order_id, spare_part_id, quantity, notes)
      VALUES (?, ?, ?, ?)
    `).run(woId, sparePartId, quantity, notes || null);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cette pièce est déjà réservée pour cet OT. Modifiez la quantité ou supprimez la réservation.' });
    }
    if (!e.message || !e.message.includes('no such table')) throw e;
    return res.status(501).json({ error: 'Table work_order_reservations absente. Exécutez les migrations.' });
  }
  const row = db.prepare(`
    SELECT r.*, sp.code as part_code, sp.name as part_name
    FROM work_order_reservations r JOIN spare_parts sp ON r.spare_part_id = sp.id
    WHERE r.work_order_id = ? AND r.spare_part_id = ?
  `).get(woId, sparePartId);
  res.status(201).json({
    id: row.id,
    workOrderId: row.work_order_id,
    sparePartId: row.spare_part_id,
    quantity: row.quantity,
    notes: row.notes,
    partCode: row.part_code,
    partName: row.part_name
  });
});

/**
 * DELETE /api/work-orders/:id/reservations/:reservationId
 */
router.delete('/:id/reservations/:reservationId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), param('reservationId').isInt(), (req, res) => {
  const result = db.prepare('DELETE FROM work_order_reservations WHERE id = ? AND work_order_id = ?').run(req.params.reservationId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Réservation non trouvée' });
  res.status(204).send();
});

/**
 * GET /api/work-orders/:id
 */
router.get('/:id', param('id').isInt(), (req, res) => {
  const row = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name,
           cb.first_name || ' ' || cb.last_name as created_by_name,
           mp.name as maintenance_plan_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    LEFT JOIN users cb ON wo.created_by = cb.id
    LEFT JOIN maintenance_plans mp ON wo.maintenance_plan_id = mp.id
    WHERE wo.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const costs = getWorkOrderCosts(req.params.id);
  res.json(formatWO(row, costs));
});

/**
 * POST /api/work-orders
 * Création OT (déclaration panne ou planifié)
 */
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN, ROLES.UTILISATEUR), [
  body('title').notEmpty().trim(),
  body('equipmentId').optional().isInt(),
  body('typeId').optional().isInt(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('description').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, description, equipmentId, typeId, priority, assignedTo, plannedStart, plannedEnd, maintenancePlanId } = req.body;
  const number = generateOTNumber();
  const failureDate = req.body.failureDate || (req.body.typeId === 2 ? new Date().toISOString() : null);
  // SLA selon priorité (Coswin: critical 2h, high 8h, medium 24h, low 72h)
  const SLA_HOURS = { critical: 2, high: 8, medium: 24, low: 72 };
  const prio = priority || 'medium';
  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + (SLA_HOURS[prio] || 24));
  const projectId = req.body.projectId || null;
  try {
    const result = db.prepare(`
      INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, assigned_to, planned_start, planned_end, maintenance_plan_id, failure_date, created_by, sla_deadline, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(number, title, description || null, equipmentId || null, typeId || 2, priority || 'medium',
      assignedTo || null, plannedStart || null, plannedEnd || null, maintenancePlanId || null, failureDate, req.user.id, slaDeadline.toISOString(), projectId);
    const woId = result.lastInsertRowid;
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

    const maintenanceUserIds = db.prepare(`
      SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance', 'administrateur')
    `).all().map((u) => u.id).filter((id) => id !== req.user.id);
    notificationService.notify('work_order_created', maintenanceUserIds, {
      number: row.number,
      title: row.title,
      equipment_name: row.equipment_name ? `${row.equipment_code || ''} ${row.equipment_name}`.trim() : null,
      priority: row.priority
    }).catch(() => {});

    auditService.log('work_order', woId, 'created', { userId: req.user?.id, userEmail: req.user?.email, summary: row.number });
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
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  param('id').isInt(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled', 'deferred'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (req.body.status === 'completed') {
    const canClose = [ROLES.ADMIN, ROLES.RESPONSABLE].includes(req.user.role_name);
    if (!canClose) return res.status(403).json({ error: 'Seul un responsable ou un administrateur peut clôturer l\'OT.' });
  }
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  const fields = ['title', 'description', 'equipment_id', 'type_id', 'priority', 'status', 'assigned_to', 'planned_start', 'planned_end', 'actual_start', 'actual_end', 'completed_by', 'completed_at', 'signature_name', 'project_id'];
  const mapping = { equipmentId: 'equipment_id', typeId: 'type_id', assignedTo: 'assigned_to', plannedStart: 'planned_start', plannedEnd: 'planned_end', actualStart: 'actual_start', actualEnd: 'actual_end', completedBy: 'completed_by', completedAt: 'completed_at', signatureName: 'signature_name', projectId: 'project_id' };
  const updates = [];
  const values = [];
  if (req.body.status === 'completed') {
    updates.push('completed_at = ?');
    values.push(new Date().toISOString().slice(0, 19));
    if (req.body.completedBy != null) {
      updates.push('completed_by = ?');
      values.push(req.body.completedBy);
    }
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
  const row = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.id = ?
  `).get(id);

  const newAssigned = req.body.assignedTo != null ? parseInt(req.body.assignedTo, 10) : null;
  const newStatus = req.body.status;
  if (previous && newAssigned !== undefined && previous.assigned_to !== newAssigned && newAssigned) {
    notificationService.notify('work_order_assigned', [newAssigned], {
      number: row.number,
      title: row.title
    }).catch(() => {});
  }
  if (previous && newStatus === 'completed' && previous.status !== 'completed') {
    const responsibles = db.prepare(`
      SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
    `).all().map((u) => u.id);
    notificationService.notify('work_order_closed', responsibles, {
      number: row.number,
      title: row.title
    }).catch(() => {});
  }

  auditService.log('work_order', id, 'updated', { userId: req.user?.id, userEmail: req.user?.email, summary: row.number });
  res.json(formatWO(row));
});

/**
 * DELETE /api/work-orders/:id (annulation)
 */
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const wo = db.prepare('SELECT number FROM work_orders WHERE id = ?').get(id);
  const result = db.prepare("UPDATE work_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  auditService.log('work_order', id, 'deleted', { userId: req.user?.id, userEmail: req.user?.email, summary: wo?.number });
  res.status(204).send();
});

module.exports = router;
