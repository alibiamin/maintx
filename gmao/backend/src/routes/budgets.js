/**
 * API Budget maintenance
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const getWorkOrderCosts = require('./workOrders').getWorkOrderCosts;

const router = express.Router();
router.use(authenticate);

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

router.get('/', (req, res) => {
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
    const withCost = rows.map((r) => ({
      ...r,
      current_cost: r.project_id ? getProjectCurrentCost(db, r.project_id) : 0
    }));
    res.json(withCost);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', param('id').isInt(), (req, res) => {
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
    res.json({ ...row, current_cost });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Budget non trouvé' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
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

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
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

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM maintenance_budgets WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Budget non trouvé' });
  res.status(204).send();
});

module.exports = router;
