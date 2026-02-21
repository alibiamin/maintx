/**
 * API Ordres de travail - Maintenance corrective et préventive
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

function formatWO(row) {
  if (!row) return null;
  return {
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
    failureDate: row.failure_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    signatureName: row.signature_name
  };
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
  const { status, assignedTo, equipmentId, priority, page, limit } = req.query;
  const usePagination = page !== undefined && page !== '';
  const limitNum = usePagination ? Math.min(parseInt(limit, 10) || 20, 100) : 1e6;
  const offset = usePagination ? ((parseInt(page, 10) || 1) - 1) * limitNum : 0;
  let where = ' WHERE 1=1';
  const params = [];
  if (status) { where += ' AND wo.status = ?'; params.push(status); }
  if (assignedTo) { where += ' AND wo.assigned_to = ?'; params.push(assignedTo); }
  if (equipmentId) { where += ' AND wo.equipment_id = ?'; params.push(equipmentId); }
  if (priority) { where += ' AND wo.priority = ?'; params.push(priority); }
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
  res.json(formatWO(row));
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
  try {
    const result = db.prepare(`
      INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, assigned_to, planned_start, planned_end, maintenance_plan_id, failure_date, created_by, sla_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(number, title, description || null, equipmentId || null, typeId || 2, priority || 'medium',
      assignedTo || null, plannedStart || null, plannedEnd || null, maintenancePlanId || null, failureDate, req.user.id, slaDeadline.toISOString());
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
  const fields = ['title', 'description', 'equipment_id', 'type_id', 'priority', 'status', 'assigned_to', 'planned_start', 'planned_end', 'actual_start', 'actual_end', 'completed_by', 'completed_at', 'signature_name'];
  const mapping = { equipmentId: 'equipment_id', typeId: 'type_id', assignedTo: 'assigned_to', plannedStart: 'planned_start', plannedEnd: 'planned_end', actualStart: 'actual_start', actualEnd: 'actual_end', completedBy: 'completed_by', completedAt: 'completed_at', signatureName: 'signature_name' };
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

  res.json(formatWO(row));
});

/**
 * DELETE /api/work-orders/:id (annulation)
 */
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const result = db.prepare("UPDATE work_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  res.status(204).send();
});

module.exports = router;
