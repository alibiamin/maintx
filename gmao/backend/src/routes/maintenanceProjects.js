/**
 * API Projets de maintenance (regroupement OT, budget)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function getWorkOrderCosts(woId) {
  let partsCost = 0;
  let laborCost = 0;
  try {
    const parts = db.prepare(`
      SELECT COALESCE(SUM(i.quantity_used * sp.unit_price), 0) as parts_cost
      FROM interventions i
      LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
      WHERE i.work_order_id = ?
    `).get(woId);
    partsCost = (parts && parts.parts_cost) ? parts.parts_cost : 0;
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  try {
    const labor = db.prepare(`
      SELECT COALESCE(SUM(i.hours_spent * u.hourly_rate), 0) as labor_cost
      FROM interventions i
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.work_order_id = ?
    `).get(woId);
    laborCost = (labor && labor.labor_cost) ? labor.labor_cost : 0;
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  const wo = db.prepare('SELECT actual_start, actual_end, assigned_to FROM work_orders WHERE id = ?').get(woId);
  if (wo && laborCost === 0 && wo.actual_start && wo.actual_end && wo.assigned_to) {
    const rate = db.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(wo.assigned_to);
    const hours = (new Date(wo.actual_end) - new Date(wo.actual_start)) / (1000 * 60 * 60);
    laborCost = hours * (rate?.hourly_rate || 0);
  }
  return { laborCost, partsCost, totalCost: laborCost + partsCost };
}

function formatProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.id,
    name: row.name,
    description: row.description,
    budgetAmount: row.budget_amount,
    siteId: row.site_id,
    siteName: row.site_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/maintenance-projects
 */
router.get('/', (req, res) => {
  try {
    const { status, siteId } = req.query;
    let sql = `
      SELECT p.*, s.name as site_name
      FROM maintenance_projects p
      LEFT JOIN sites s ON p.site_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (siteId) { sql += ' AND p.site_id = ?'; params.push(siteId); }
    sql += ' ORDER BY p.created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(formatProject));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

/**
 * GET /api/maintenance-projects/:id
 */
router.get('/:id', param('id').isInt(), (req, res) => {
  const row = db.prepare(`
    SELECT p.*, s.name as site_name
    FROM maintenance_projects p
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Projet non trouvé' });
  const project = formatProject(row);
  let workOrders = [];
  try {
    const woRows = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.status, wo.priority, wo.planned_start, wo.planned_end,
             e.name as equipment_name, e.code as equipment_code
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.project_id = ?
      ORDER BY wo.planned_start ASC, wo.number
    `).all(req.params.id);
    workOrders = woRows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status,
      priority: r.priority,
      plannedStart: r.planned_start,
      plannedEnd: r.planned_end,
      equipmentName: r.equipment_name,
      equipmentCode: r.equipment_code,
      ...getWorkOrderCosts(r.id)
    }));
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.totalCost || 0), 0);
  project.workOrders = workOrders;
  project.totalCost = totalCost;
  project.budgetAmount = row.budget_amount ?? 0;
  res.json(project);
});

/**
 * GET /api/maintenance-projects/:id/work-orders — liste des OT du projet (ids pour liaison)
 */
router.get('/:id/work-orders', param('id').isInt(), (req, res) => {
  const project = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.status
      FROM work_orders wo
      WHERE wo.project_id = ?
      ORDER BY wo.number
    `).all(req.params.id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  res.json(rows.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status })));
});

/**
 * POST /api/maintenance-projects
 */
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('budgetAmount').optional().isFloat({ min: 0 }).withMessage('Budget invalide'),
  body('status').optional().isIn(['draft', 'active', 'completed', 'cancelled'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(' ; ') || 'Données invalides';
    return res.status(400).json({ error: msg, errors: errors.array() });
  }
  const { name, description, budgetAmount, siteId, startDate, endDate, status } = req.body;
  const nameStr = (name && typeof name === 'string' ? name.trim() : '') || '';
  if (!nameStr) return res.status(400).json({ error: 'Le nom est requis' });
  const amount = budgetAmount != null && !Number.isNaN(Number(budgetAmount)) ? Number(budgetAmount) : 0;
  const siteIdInt = siteId != null && siteId !== '' ? parseInt(siteId, 10) : null;
  const finalSiteId = (siteIdInt != null && !Number.isNaN(siteIdInt)) ? siteIdInt : null;
  if (finalSiteId != null) {
    const siteExists = db.prepare('SELECT id FROM sites WHERE id = ?').get(finalSiteId);
    if (!siteExists) return res.status(400).json({ error: 'Site sélectionné introuvable' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO maintenance_projects (name, description, budget_amount, site_id, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nameStr,
      description || null,
      amount,
      finalSiteId,
      startDate || null,
      endDate || null,
      status || 'active'
    );
    const row = db.prepare(`
      SELECT p.*, s.name as site_name FROM maintenance_projects p
      LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(formatProject(row));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table maintenance_projects absente. Exécutez les migrations.' });
    if (e.message && e.message.includes('FOREIGN KEY')) return res.status(400).json({ error: 'Site invalide.' });
    throw e;
  }
});

/**
 * PUT /api/maintenance-projects/:id
 */
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim(),
  body('status').optional().isIn(['draft', 'active', 'completed', 'cancelled'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });
  const { name, description, budgetAmount, siteId, startDate, endDate, status } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (budgetAmount !== undefined) { updates.push('budget_amount = ?'); params.push(parseFloat(budgetAmount)); }
  if (siteId !== undefined) { updates.push('site_id = ?'); params.push(siteId || null); }
  if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate || null); }
  if (endDate !== undefined) { updates.push('end_date = ?'); params.push(endDate || null); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  db.prepare(`UPDATE maintenance_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare(`
    SELECT p.*, s.name as site_name FROM maintenance_projects p
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE p.id = ?
  `).get(id);
  res.json(formatProject(row));
});

/**
 * DELETE /api/maintenance-projects/:id
 */
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });
  try {
    db.prepare('UPDATE work_orders SET project_id = NULL WHERE project_id = ?').run(id);
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  db.prepare('DELETE FROM maintenance_projects WHERE id = ?').run(id);
  res.status(204).send();
});

/**
 * POST /api/maintenance-projects/:id/link-work-order — attacher un OT au projet
 */
router.post('/:id/link-work-order', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('workOrderId').isInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const projectId = req.params.id;
  const workOrderId = req.body.workOrderId;
  const project = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
  const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(workOrderId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  try {
    db.prepare('UPDATE work_orders SET project_id = ? WHERE id = ?').run(projectId, workOrderId);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) return res.status(501).json({ error: 'Colonne project_id absente. Exécutez les migrations.' });
    throw e;
  }
  res.json({ linked: true, workOrderId, projectId });
});

/**
 * POST /api/maintenance-projects/:id/unlink-work-order — détacher un OT du projet
 */
router.post('/:id/unlink-work-order', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('workOrderId').isInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const projectId = req.params.id;
  const workOrderId = req.body.workOrderId;
  try {
    const result = db.prepare('UPDATE work_orders SET project_id = NULL WHERE id = ? AND project_id = ?').run(workOrderId, projectId);
    if (result.changes === 0) return res.status(404).json({ error: 'OT non trouvé ou non rattaché à ce projet' });
  } catch (e) {
    if (e.message && e.message.includes('no such column')) return res.status(501).json({ error: 'Colonne project_id absente. Exécutez les migrations.' });
    throw e;
  }
  res.json({ unlinked: true, workOrderId, projectId });
});

module.exports = router;
