/**
 * API Ordres de sous-traitance (liés aux OT)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function generateOrderNumber(db) {
  try {
    const year = new Date().getFullYear();
    const last = db.prepare('SELECT number FROM subcontract_orders WHERE number LIKE ? ORDER BY id DESC LIMIT 1').get(`ST-${year}-%`);
    const n = last ? parseInt(last.number.split('-')[2], 10) + 1 : 1;
    return `ST-${year}-${String(n).padStart(4, '0')}`;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return `ST-${new Date().getFullYear()}-0001`;
    throw e;
  }
}

router.get('/', requirePermission('subcontract_orders', 'view'), (req, res) => {
  const db = req.db;
  try {
    const { contractorId, workOrderId, maintenancePlanId, maintenanceProjectId, status } = req.query;
    let sql = `
      SELECT so.*, ec.name as contractor_name, ec.code as contractor_code,
             wo.number as wo_number, wo.title as wo_title,
             mp.name as plan_name, mp.id as maintenance_plan_id,
             mproj.name as project_name, mproj.id as maintenance_project_id
      FROM subcontract_orders so
      JOIN external_contractors ec ON so.contractor_id = ec.id
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      LEFT JOIN maintenance_plans mp ON so.maintenance_plan_id = mp.id
      LEFT JOIN maintenance_projects mproj ON so.maintenance_project_id = mproj.id
      WHERE 1=1
    `;
    const params = [];
    if (contractorId) { sql += ' AND so.contractor_id = ?'; params.push(contractorId); }
    if (workOrderId) { sql += ' AND so.work_order_id = ?'; params.push(workOrderId); }
    if (maintenancePlanId) { sql += ' AND so.maintenance_plan_id = ?'; params.push(maintenancePlanId); }
    if (maintenanceProjectId) { sql += ' AND so.maintenance_project_id = ?'; params.push(maintenanceProjectId); }
    if (status) { sql += ' AND so.status = ?'; params.push(status); }
    sql += ' ORDER BY so.created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    if (e.message && e.message.includes('no such column')) {
      try {
        return res.json(db.prepare(`
          SELECT so.*, ec.name as contractor_name, ec.code as contractor_code,
                 wo.number as wo_number, wo.title as wo_title
          FROM subcontract_orders so
          JOIN external_contractors ec ON so.contractor_id = ec.id
          LEFT JOIN work_orders wo ON so.work_order_id = wo.id
          ORDER BY so.created_at DESC
        `).all());
      } catch (_) { return res.json([]); }
    }
    throw e;
  }
});

router.get('/:id', requirePermission('subcontract_orders', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    let row = null;
    try {
      row = db.prepare(`
        SELECT so.*, ec.name as contractor_name, ec.code as contractor_code, ec.contact_person, ec.email, ec.phone,
               wo.number as wo_number, wo.title as wo_title, wo.status as wo_status,
               mp.name as plan_name, mp.id as maintenance_plan_id,
               mproj.name as project_name, mproj.id as maintenance_project_id
        FROM subcontract_orders so
        JOIN external_contractors ec ON so.contractor_id = ec.id
        LEFT JOIN work_orders wo ON so.work_order_id = wo.id
        LEFT JOIN maintenance_plans mp ON so.maintenance_plan_id = mp.id
        LEFT JOIN maintenance_projects mproj ON so.maintenance_project_id = mproj.id
        WHERE so.id = ?
      `).get(req.params.id);
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        row = db.prepare(`
          SELECT so.*, ec.name as contractor_name, ec.code as contractor_code, ec.contact_person, ec.email, ec.phone,
                 wo.number as wo_number, wo.title as wo_title, wo.status as wo_status
          FROM subcontract_orders so
          JOIN external_contractors ec ON so.contractor_id = ec.id
          LEFT JOIN work_orders wo ON so.work_order_id = wo.id
          WHERE so.id = ?
        `).get(req.params.id);
      } else throw e;
    }
    if (!row) return res.status(404).json({ error: 'Ordre de sous-traitance non trouvé' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Ordre non trouvé' });
    throw e;
  }
});

function normalizeLink(workOrderId, maintenancePlanId, maintenanceProjectId) {
  if (workOrderId) return { work_order_id: workOrderId, maintenance_plan_id: null, maintenance_project_id: null };
  if (maintenancePlanId) return { work_order_id: null, maintenance_plan_id: maintenancePlanId, maintenance_project_id: null };
  if (maintenanceProjectId) return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: maintenanceProjectId };
  return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: null };
}

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('contractorId').isInt(),
  body('workOrderId').optional().isInt(),
  body('maintenancePlanId').optional().isInt(),
  body('maintenanceProjectId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { contractorId, workOrderId, maintenancePlanId, maintenanceProjectId, description, orderDate, expectedDate, amount, notes } = req.body;
  const link = normalizeLink(workOrderId || null, maintenancePlanId || null, maintenanceProjectId || null);
  const number = generateOrderNumber(db);
  try {
    const hasPlanProject = () => {
      try { db.prepare('SELECT maintenance_plan_id FROM subcontract_orders LIMIT 1').get(); return true; } catch (_) { return false; }
    };
    if (hasPlanProject()) {
      const r = db.prepare(`
        INSERT INTO subcontract_orders (number, contractor_id, work_order_id, maintenance_plan_id, maintenance_project_id, description, order_date, expected_date, amount, notes, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
      `).run(number, contractorId, link.work_order_id, link.maintenance_plan_id, link.maintenance_project_id, description || null, orderDate || null, expectedDate || null, amount != null ? Number(amount) : 0, notes || null, req.user.id);
      const row = db.prepare(`
        SELECT so.*, ec.name as contractor_name, wo.number as wo_number, wo.title as wo_title,
               mp.name as plan_name, mproj.name as project_name
        FROM subcontract_orders so
        JOIN external_contractors ec ON so.contractor_id = ec.id
        LEFT JOIN work_orders wo ON so.work_order_id = wo.id
        LEFT JOIN maintenance_plans mp ON so.maintenance_plan_id = mp.id
        LEFT JOIN maintenance_projects mproj ON so.maintenance_project_id = mproj.id
        WHERE so.id = ?
      `).get(r.lastInsertRowid);
      return res.status(201).json(row);
    }
    const r = db.prepare(`
      INSERT INTO subcontract_orders (number, contractor_id, work_order_id, description, order_date, expected_date, amount, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(number, contractorId, link.work_order_id, description || null, orderDate || null, expectedDate || null, amount != null ? Number(amount) : 0, notes || null, req.user.id);
    const row = db.prepare(`
      SELECT so.*, ec.name as contractor_name, wo.number as wo_number, wo.title as wo_title
      FROM subcontract_orders so
      JOIN external_contractors ec ON so.contractor_id = ec.id
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      WHERE so.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table subcontract_orders non disponible' });
    throw e;
  }
});

router.put('/:id', requirePermission('subcontract_orders', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM subcontract_orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Ordre de sous-traitance non trouvé' });
  const { contractorId, workOrderId, maintenancePlanId, maintenanceProjectId, description, status, orderDate, expectedDate, completedDate, amount, notes } = req.body;
  let woId = existing.work_order_id;
  let planId = existing.maintenance_plan_id;
  let projId = existing.maintenance_project_id;
  if (workOrderId !== undefined || maintenancePlanId !== undefined || maintenanceProjectId !== undefined) {
    const link = normalizeLink(
      workOrderId !== undefined ? workOrderId : null,
      maintenancePlanId !== undefined ? maintenancePlanId : null,
      maintenanceProjectId !== undefined ? maintenanceProjectId : null
    );
    woId = link.work_order_id;
    planId = link.maintenance_plan_id;
    projId = link.maintenance_project_id;
  }
  const hasPlanProject = () => { try { db.prepare('SELECT maintenance_plan_id FROM subcontract_orders LIMIT 1').get(); return true; } catch (_) { return false; } };
  if (hasPlanProject()) {
    db.prepare(`
      UPDATE subcontract_orders SET contractor_id = ?, work_order_id = ?, maintenance_plan_id = ?, maintenance_project_id = ?, description = ?, status = ?, order_date = ?, expected_date = ?, completed_date = ?, amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(
      contractorId ?? existing.contractor_id,
      woId,
      planId,
      projId,
      description !== undefined ? description : existing.description,
      status ?? existing.status,
      orderDate !== undefined ? orderDate : existing.order_date,
      expectedDate !== undefined ? expectedDate : existing.expected_date,
      completedDate !== undefined ? completedDate : existing.completed_date,
      amount !== undefined ? Number(amount) : existing.amount,
      notes !== undefined ? notes : existing.notes,
      id
    );
    return res.json(db.prepare(`
      SELECT so.*, ec.name as contractor_name, wo.number as wo_number, wo.title as wo_title,
             mp.name as plan_name, mproj.name as project_name
      FROM subcontract_orders so
      JOIN external_contractors ec ON so.contractor_id = ec.id
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      LEFT JOIN maintenance_plans mp ON so.maintenance_plan_id = mp.id
      LEFT JOIN maintenance_projects mproj ON so.maintenance_project_id = mproj.id
      WHERE so.id = ?
    `).get(id));
  }
  db.prepare(`
    UPDATE subcontract_orders SET contractor_id = ?, work_order_id = ?, description = ?, status = ?, order_date = ?, expected_date = ?, completed_date = ?, amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(
    contractorId ?? existing.contractor_id,
    woId,
    description !== undefined ? description : existing.description,
    status ?? existing.status,
    orderDate !== undefined ? orderDate : existing.order_date,
    expectedDate !== undefined ? expectedDate : existing.expected_date,
    completedDate !== undefined ? completedDate : existing.completed_date,
    amount !== undefined ? Number(amount) : existing.amount,
    notes !== undefined ? notes : existing.notes,
    id
  );
  res.json(db.prepare(`
    SELECT so.*, ec.name as contractor_name, wo.number as wo_number, wo.title as wo_title
    FROM subcontract_orders so
    JOIN external_contractors ec ON so.contractor_id = ec.id
    LEFT JOIN work_orders wo ON so.work_order_id = wo.id
    WHERE so.id = ?
  `).get(id));
});

router.delete('/:id', requirePermission('subcontract_orders', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM subcontract_orders WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Ordre non trouvé' });
  res.status(204).send();
});

module.exports = router;
