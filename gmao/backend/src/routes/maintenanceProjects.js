/**
 * API Projets de maintenance — regroupement d’OT, budget, site.
 * Routes : liste, détail, création, mise à jour, suppression, liaison OT.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const PROJECT_STATUSES = ['draft', 'active', 'completed', 'cancelled'];

function toProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    budgetAmount: row.budget_amount ?? 0,
    siteId: row.site_id ?? null,
    siteName: row.site_name ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    status: row.status ?? 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWoCosts(woId) {
  let parts = 0, labor = 0;
  try {
    const r = db.prepare(`
      SELECT COALESCE(SUM(i.quantity_used * sp.unit_price), 0) as c
      FROM interventions i LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
      WHERE i.work_order_id = ?
    `).get(woId);
    parts = r?.c ?? 0;
  } catch (e) {
    if (!e.message?.includes('no such table')) throw e;
  }
  try {
    const r = db.prepare(`
      SELECT COALESCE(SUM(i.hours_spent * u.hourly_rate), 0) as c
      FROM interventions i LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.work_order_id = ?
    `).get(woId);
    labor = r?.c ?? 0;
  } catch (e) {
    if (!e.message?.includes('no such table')) throw e;
  }
  const wo = db.prepare('SELECT actual_start, actual_end, assigned_to FROM work_orders WHERE id = ?').get(woId);
  if (wo && labor === 0 && wo.actual_start && wo.actual_end && wo.assigned_to) {
    const rate = db.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(wo.assigned_to);
    const h = (new Date(wo.actual_end) - new Date(wo.actual_start)) / (1000 * 60 * 60);
    labor = h * (rate?.hourly_rate ?? 0);
  }
  return { laborCost: labor, partsCost: parts, totalCost: labor + parts };
}

function list(req, res) {
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
    return res.json(rows.map(toProject));
  } catch (e) {
    if (e.message?.includes('no such table')) return res.json([]);
    throw e;
  }
}

function getOne(req, res) {
  const id = req.params.id;
  const row = db.prepare(`
    SELECT p.*, s.name as site_name
    FROM maintenance_projects p
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE p.id = ?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Projet non trouvé' });
  const project = toProject(row);
  let workOrders = [];
  try {
    const woRows = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.status, wo.priority, wo.planned_start, wo.planned_end,
             e.name as equipment_name, e.code as equipment_code
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.project_id = ?
      ORDER BY wo.planned_start ASC, wo.number
    `).all(id);
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
      ...getWoCosts(r.id),
    }));
  } catch (e) {
    if (!e.message?.includes('no such column')) throw e;
  }
  project.workOrders = workOrders;
  project.totalCost = workOrders.reduce((s, wo) => s + (wo.totalCost ?? 0), 0);
  project.budgetAmount = row.budget_amount ?? 0;
  res.json(project);
}

function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map((e) => e.msg).join(' ; ') || 'Données invalides';
    return res.status(400).json({ error: msg, errors: errors.array() });
  }
  const { name, description, budgetAmount, siteId, startDate, endDate, status } = req.body;
  const nameStr = (name && typeof name === 'string' ? name.trim() : '') || '';
  if (!nameStr) return res.status(400).json({ error: 'Le nom est requis' });
  const amount = budgetAmount != null && !Number.isNaN(Number(budgetAmount)) ? Number(budgetAmount) : 0;
  let sid = null;
  if (siteId != null && siteId !== '') {
    const n = parseInt(siteId, 10);
    if (!Number.isNaN(n)) {
      const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(n);
      if (!site) return res.status(400).json({ error: 'Site introuvable' });
      sid = n;
    }
  }
  try {
    const r = db.prepare(`
      INSERT INTO maintenance_projects (name, description, budget_amount, site_id, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nameStr, description?.trim() || null, amount, sid, startDate || null, endDate || null, status || 'active');
    const row = db.prepare(`
      SELECT p.*, s.name as site_name FROM maintenance_projects p
      LEFT JOIN sites s ON p.site_id = s.id WHERE p.id = ?
    `).get(r.lastInsertRowid);
    return res.status(201).json(toProject(row));
  } catch (e) {
    if (e.message?.includes('no such table')) return res.status(501).json({ error: 'Table maintenance_projects absente. Exécutez les migrations.' });
    if (e.message?.includes('FOREIGN KEY')) return res.status(400).json({ error: 'Site invalide.' });
    throw e;
  }
}

function update(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });
  const { name, description, budgetAmount, siteId, startDate, endDate, status } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(typeof name === 'string' ? name.trim() : name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description ?? null); }
  if (budgetAmount !== undefined) { updates.push('budget_amount = ?'); params.push(Number(budgetAmount)); }
  if (siteId !== undefined) { updates.push('site_id = ?'); params.push(siteId == null || siteId === '' ? null : parseInt(siteId, 10)); }
  if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate || null); }
  if (endDate !== undefined) { updates.push('end_date = ?'); params.push(endDate || null); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  db.prepare(`UPDATE maintenance_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare(`
    SELECT p.*, s.name as site_name FROM maintenance_projects p
    LEFT JOIN sites s ON p.site_id = s.id WHERE p.id = ?
  `).get(id);
  res.json(toProject(row));
}

function remove(req, res) {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });
  try {
    db.prepare('UPDATE work_orders SET project_id = NULL WHERE project_id = ?').run(id);
  } catch (e) {
    if (!e.message?.includes('no such column')) throw e;
  }
  db.prepare('DELETE FROM maintenance_projects WHERE id = ?').run(id);
  res.status(204).send();
}

function linkWorkOrder(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const projectId = parseInt(req.params.id, 10);
  const workOrderId = req.body.workOrderId;
  if (!db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(projectId)) return res.status(404).json({ error: 'Projet non trouvé' });
  if (!db.prepare('SELECT id FROM work_orders WHERE id = ?').get(workOrderId)) return res.status(404).json({ error: 'Ordre de travail non trouvé' });
  try {
    db.prepare('UPDATE work_orders SET project_id = ? WHERE id = ?').run(projectId, workOrderId);
  } catch (e) {
    if (e.message?.includes('no such column')) return res.status(501).json({ error: 'Colonne project_id absente. Exécutez les migrations.' });
    throw e;
  }
  res.json({ linked: true, workOrderId, projectId });
}

function unlinkWorkOrder(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const projectId = parseInt(req.params.id, 10);
  const workOrderId = req.body.workOrderId;
  const r = db.prepare('UPDATE work_orders SET project_id = NULL WHERE id = ? AND project_id = ?').run(workOrderId, projectId);
  if (r.changes === 0) return res.status(404).json({ error: 'OT non trouvé ou non rattaché à ce projet' });
  res.json({ unlinked: true, workOrderId, projectId });
}

// ——— Routes (ordre : spécifique avant :id) ———

router.get('/', list);

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('budgetAmount').optional().isFloat({ min: 0 }).withMessage('Budget invalide'),
  body('status').optional().isIn(PROJECT_STATUSES),
], create);

router.get('/:id/work-orders', param('id').isInt(), (req, res) => {
  const id = req.params.id;
  if (!db.prepare('SELECT id FROM maintenance_projects WHERE id = ?').get(id)) return res.status(404).json({ error: 'Projet non trouvé' });
  let rows = [];
  try {
    rows = db.prepare('SELECT id, number, title, status FROM work_orders WHERE project_id = ? ORDER BY number').all(id);
  } catch (e) {
    if (!e.message?.includes('no such column')) throw e;
  }
  res.json(rows.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status })));
});

router.post('/:id/link-work-order', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('workOrderId').isInt(),
], linkWorkOrder);

router.post('/:id/unlink-work-order', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('workOrderId').isInt(),
], unlinkWorkOrder);

router.get('/:id', param('id').isInt(), getOne);

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').optional().trim().notEmpty(),
  body('status').optional().isIn(PROJECT_STATUSES),
], update);

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), remove);

module.exports = router;
