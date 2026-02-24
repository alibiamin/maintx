/**
 * API Demandes d'intervention (portail Open type COSWIN)
 * Workflow : demande → validation/rejet par responsable → création OT si validé
 * Numéro : généré automatiquement via codification (paramétrage > préfixe + compteur).
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const codification = require('../services/codification');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

function getResponsibles(db, tenantId) {
  const roleNames = ['responsable_maintenance', 'administrateur'];
  const placeholders = roleNames.map(() => '?').join(',');
  if (tenantId != null) {
    try {
      return dbModule.getAdminDb().prepare(`
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

function formatRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentCode: row.equipment_code,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    priority: row.priority,
    status: row.status,
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/intervention-requests
 * Liste des demandes (filtre status, requestedBy)
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'validated', 'rejected']),
  query('requestedBy').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  let where = ' WHERE 1=1';
  const params = [];
  if (req.query.status) { where += ' AND ir.status = ?'; params.push(req.query.status); }
  if (req.query.requestedBy) { where += ' AND ir.requested_by = ?'; params.push(req.query.requestedBy); }
  const sql = `
    SELECT ir.*,
           e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as requested_by_name,
           wo.number as work_order_number
    FROM intervention_requests ir
    LEFT JOIN equipment e ON ir.equipment_id = e.id
    LEFT JOIN users u ON ir.requested_by = u.id
    LEFT JOIN work_orders wo ON ir.work_order_id = wo.id
    ${where}
    ORDER BY ir.created_at DESC
  `;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(formatRequest));
});

/**
 * POST /api/intervention-requests
 * Créer une demande (tout utilisateur connecté, type Open)
 */
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN, ROLES.UTILISATEUR), [
  body('title').notEmpty().trim(),
  body('description').optional().trim(),
  body('equipmentId').optional().isInt(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, description, equipmentId, priority } = req.body;
  let number = codification.getNextCode(db, 'demande_intervention');
  if (!number || !String(number).trim()) {
    number = null;
  }
  const result = db.prepare(`
    INSERT INTO intervention_requests (number, title, description, equipment_id, requested_by, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(number || '', title || '', description || null, equipmentId || null, req.user.id, priority || 'medium');
  const id = result.lastInsertRowid;
  if (!number) {
    const pad = (n, len) => String(n).padStart(len, '0');
    number = 'DI-' + pad(id, 4);
    try {
      db.prepare('UPDATE intervention_requests SET number = ? WHERE id = ?').run(number, id);
    } catch (_) {}
  }
  const row = db.prepare(`
    SELECT ir.*, e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as requested_by_name
    FROM intervention_requests ir
    LEFT JOIN equipment e ON ir.equipment_id = e.id
    LEFT JOIN users u ON ir.requested_by = u.id
    WHERE ir.id = ?
  `).get(id);
  const responsibles = getResponsibles(db, req.tenantId).filter((uid) => uid !== req.user.id);
  notificationService.notify(db, 'work_order_created', responsibles, {
    number: row.number || `Demande #${id}`,
    title: `Nouvelle demande d'intervention : ${title}`,
    equipment_name: row.equipment_name ? `${row.equipment_code || ''} ${row.equipment_name}`.trim() : null,
    priority: row.priority
  }, req.tenantId).catch(() => {});
  res.status(201).json(formatRequest(row));
});

/**
 * GET /api/intervention-requests/:id
 */
router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare(`
    SELECT ir.*, e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as requested_by_name,
           wo.number as work_order_number
    FROM intervention_requests ir
    LEFT JOIN equipment e ON ir.equipment_id = e.id
    LEFT JOIN users u ON ir.requested_by = u.id
    LEFT JOIN work_orders wo ON ir.work_order_id = wo.id
    WHERE ir.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Demande non trouvée' });
  res.json(formatRequest(row));
});

/**
 * PUT /api/intervention-requests/:id/validate
 * Valider la demande et créer un OT (responsable ou admin)
 */
router.put('/:id/validate', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('title').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const reqRow = db.prepare('SELECT * FROM intervention_requests WHERE id = ?').get(id);
  if (!reqRow) return res.status(404).json({ error: 'Demande non trouvée' });
  if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée' });
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT number FROM work_orders WHERE number LIKE ? ORDER BY id DESC LIMIT 1').get(`OT-${year}-%`);
  const num = last ? parseInt(last.number.split('-')[2]) + 1 : 1;
  const number = `OT-${year}-${String(num).padStart(4, '0')}`;
  const SLA_HOURS = { critical: 2, high: 8, medium: 24, low: 72 };
  const prio = req.body.priority || reqRow.priority || 'medium';
  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + (SLA_HOURS[prio] || 24));
  const woTitle = (req.body.title && req.body.title.trim()) ? req.body.title.trim() : reqRow.title;
  const typeCorrective = db.prepare("SELECT id FROM work_order_types WHERE LOWER(name) LIKE '%correctif%' OR LOWER(name) LIKE '%corrective%' LIMIT 1").get();
  const typeId = typeCorrective ? typeCorrective.id : 2;
  const woResult = db.prepare(`
    INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, maintenance_plan_id, failure_date, created_by, declared_by, validated_by, sla_deadline)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(number, woTitle, reqRow.description || null, reqRow.equipment_id, typeId, prio,
    new Date().toISOString(), req.user.id, reqRow.requested_by, req.user.id, slaDeadline.toISOString());
  const woId = woResult.lastInsertRowid;
  db.prepare(`
    UPDATE intervention_requests SET status = 'validated', work_order_id = ?, validated_by = ?, validated_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(woId, req.user.id, new Date().toISOString().slice(0, 19), id);
  const wo = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code
    FROM work_orders wo LEFT JOIN equipment e ON wo.equipment_id = e.id WHERE wo.id = ?
  `).get(woId);
  const updated = db.prepare(`
    SELECT ir.*, e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as requested_by_name, ? as work_order_number
    FROM intervention_requests ir
    LEFT JOIN equipment e ON ir.equipment_id = e.id
    LEFT JOIN users u ON ir.requested_by = u.id
    WHERE ir.id = ?
  `).get(number, id);
  notificationService.notify(db, 'work_order_created', [], { number: wo.number, title: wo.title, equipment_name: wo.equipment_name, priority: wo.priority }, req.tenantId).catch(() => {});
  res.json({ request: formatRequest(updated), workOrder: { id: woId, number: wo.number, title: wo.title } });
});

/**
 * PUT /api/intervention-requests/:id/reject
 * Rejeter la demande (responsable ou admin)
 */
router.put('/:id/reject', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('rejectionReason').optional().trim()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const reqRow = db.prepare('SELECT * FROM intervention_requests WHERE id = ?').get(id);
  if (!reqRow) return res.status(404).json({ error: 'Demande non trouvée' });
  if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée' });
  db.prepare(`
    UPDATE intervention_requests SET status = 'rejected', validated_by = ?, validated_at = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(req.user.id, new Date().toISOString().slice(0, 19), (req.body.rejectionReason || '').trim(), id);
  const row = db.prepare(`
    SELECT ir.*, e.name as equipment_name, e.code as equipment_code,
           u.first_name || ' ' || u.last_name as requested_by_name, NULL as work_order_number
    FROM intervention_requests ir
    LEFT JOIN equipment e ON ir.equipment_id = e.id
    LEFT JOIN users u ON ir.requested_by = u.id
    WHERE ir.id = ?
  `).get(id);
  res.json(formatRequest(row));
});

module.exports = router;
