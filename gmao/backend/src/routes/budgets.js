/**
 * API Budget maintenance
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const getWorkOrderCosts = require('./workOrders').getWorkOrderCosts;
const notificationService = require('../services/notificationService');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

/**
 * Vérifie le dépassement de budget (seuil %) et crée une alerte + notification si dépassement.
 * À appeler après clôture OT ou consultation des budgets.
 */
function checkBudgetOverrun(db, budgetId, currentCost, amount, budgetName, tenantId) {
  if (amount == null || amount <= 0 || currentCost == null) return;
  let thresholdPercent = 90;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('budget_alert_threshold_percent');
    if (r?.value != null) thresholdPercent = parseFloat(r.value) || 90;
  } catch (_) {}
  const limit = amount * (thresholdPercent / 100);
  if (currentCost < limit) return;
  const percent = amount > 0 ? Math.round((currentCost / amount) * 100) : 0;
  try {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE entity_type = 'budget' AND entity_id = ? AND is_read = 0
      AND date(created_at) = date('now')
    `).get(budgetId);
    if (existing) return;
    db.prepare(`
      INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'custom',
      'warning',
      'Dépassement budget',
      `${budgetName || 'Budget'} : consommé ${Number(currentCost).toFixed(2)} / budget ${Number(amount).toFixed(2)} (${percent}%).`,
      'budget',
      budgetId
    );
    const adminDb = dbModule.getAdminDb && dbModule.getAdminDb();
    const userDb = tenantId != null ? adminDb : db;
    if (userDb) {
      const responsibles = userDb.prepare(`
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
        ${tenantId != null ? ' AND u.tenant_id = ?' : ''}
      `).all(...(tenantId != null ? [tenantId] : []));
      const ids = (responsibles || []).map((u) => u.id);
      notificationService.notify(db, 'budget_overrun', ids, {
        budget_name: budgetName,
        current_cost: currentCost,
        amount,
        percent: `${percent}%`
      }, tenantId).catch(() => {});
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('[budgets] checkBudgetOverrun:', e.message);
  }
}

/** Cumul des coûts des OT attachés à un projet (main d'œuvre, pièces, sous-traitance) */
function getProjectCurrentCost(db, projectId) {
  if (projectId == null) return 0;
  let total = 0;
  try {
    const woIds = db.prepare('SELECT id FROM work_orders WHERE project_id = ?').all(projectId);
    const processed = new Set();
    for (const row of woIds || []) {
      const woId = row.id;
      if (woId == null || processed.has(Number(woId))) continue;
      processed.add(Number(woId));
      if (typeof getWorkOrderCosts === 'function') {
        try {
          const costs = getWorkOrderCosts(db, woId);
          if (costs && costs.totalCost != null) total += Number(costs.totalCost) || 0;
        } catch (_) {}
      }
      try {
        const sub = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM subcontract_orders WHERE work_order_id = ?').get(woId);
        total += Number(sub?.s) || 0;
      } catch (_) {}
    }
  } catch (_) {}
  return Math.round(total * 100) / 100;
}

router.get('/', requirePermission('budgets', 'view'), (req, res) => {
  const db = req.db;
  try {
    const { siteId, year, projectId } = req.query;
    let sql = `
      SELECT b.*, s.name as site_name, p.name as project_name
      FROM maintenance_budgets b
      LEFT JOIN sites s ON b.site_id = s.id
      LEFT JOIN maintenance_projects p ON b.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (siteId) { sql += ' AND b.site_id = ?'; params.push(siteId); }
    if (year) { sql += ' AND b.year = ?'; params.push(year); }
    if (projectId) { sql += ' AND b.project_id = ?'; params.push(projectId); }
    sql += ' ORDER BY b.year DESC, b.name';
    const rows = db.prepare(sql).all(...params);
    const withCost = rows.map((r) => {
      const current_cost = r.project_id ? getProjectCurrentCost(db, r.project_id) : 0;
      if (r.project_id && r.amount != null && r.amount > 0) {
        checkBudgetOverrun(db, r.id, current_cost, r.amount, r.name, req.tenantId);
      }
      return { ...r, current_cost: current_cost };
    });
    res.json(withCost);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', requirePermission('budgets', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare(`
      SELECT b.*, s.name as site_name, p.name as project_name
      FROM maintenance_budgets b
      LEFT JOIN sites s ON b.site_id = s.id
      LEFT JOIN maintenance_projects p ON b.project_id = p.id
      WHERE b.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Budget non trouvé' });
    const current_cost = row.project_id ? getProjectCurrentCost(db, row.project_id) : 0;
    if (row.project_id && row.amount != null && row.amount > 0) {
      checkBudgetOverrun(db, row.id, current_cost, row.amount, row.name, req.tenantId);
    }
    res.json({ ...row, current_cost });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Budget non trouvé' });
    throw e;
  }
});

router.post('/', requirePermission('budgets', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim(),
  body('year').isInt({ min: 2000, max: 2100 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, siteId, projectId, year, amount, currency, notes } = req.body;
  try {
    const r = db.prepare(`
      INSERT INTO maintenance_budgets (name, site_id, project_id, year, amount, currency, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, siteId || null, projectId || null, year, amount != null ? Number(amount) : 0, currency || 'EUR', notes || null);
    const row = db.prepare(`
      SELECT b.*, s.name as site_name, p.name as project_name
      FROM maintenance_budgets b
      LEFT JOIN sites s ON b.site_id = s.id
      LEFT JOIN maintenance_projects p ON b.project_id = p.id
      WHERE b.id = ?
    `).get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table maintenance_budgets non disponible' });
    throw e;
  }
});

router.put('/:id', requirePermission('budgets', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('name').optional().notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM maintenance_budgets WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Budget non trouvé' });
  const { name, siteId, projectId, year, amount, currency, notes } = req.body;
  db.prepare(`
    UPDATE maintenance_budgets SET name = ?, site_id = ?, project_id = ?, year = ?, amount = ?, currency = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(
    name ?? existing.name,
    siteId !== undefined ? siteId : existing.site_id,
    projectId !== undefined ? projectId : existing.project_id,
    year ?? existing.year,
    amount !== undefined ? Number(amount) : existing.amount,
    currency ?? existing.currency,
    notes !== undefined ? notes : existing.notes,
    id
  );
  res.json(db.prepare(`
    SELECT b.*, s.name as site_name, p.name as project_name
    FROM maintenance_budgets b
    LEFT JOIN sites s ON b.site_id = s.id
    LEFT JOIN maintenance_projects p ON b.project_id = p.id
    WHERE b.id = ?
  `).get(id));
});

router.delete('/:id', requirePermission('budgets', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM maintenance_budgets WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Budget non trouvé' });
  res.status(204).send();
});

module.exports = router;
module.exports.checkBudgetOverrun = checkBudgetOverrun;
module.exports.getProjectCurrentCost = getProjectCurrentCost;
