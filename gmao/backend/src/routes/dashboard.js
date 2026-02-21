/**
 * API Tableau de bord - KPIs et statistiques
 */

const express = require('express');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// SLA en heures par priorité (Coswin-like)
const SLA_HOURS = { critical: 2, high: 8, medium: 24, low: 72 };

/**
 * GET /api/dashboard/kpis
 * KPIs professionnels : Disponibilité, OEE (simplifié), MTTR, MTBF, coûts, SLA
 */
router.get('/kpis', (req, res) => {
  const { period = 30 } = req.query; // jours
  const since = `date('now', '-${parseInt(period) || 30} days')`;

  const equipment = db.prepare('SELECT COUNT(*) as total FROM equipment WHERE status != "retired"').get();
  const operational = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status = "operational"').get();
  const total = equipment.total || 1;
  const availabilityRate = ((operational.c / total) * 100).toFixed(2);

  // MTTR moyen (heures)
  const mttrRow = db.prepare(`
    SELECT AVG((julianday(actual_end) - julianday(actual_start)) * 24) as mttr
    FROM work_orders WHERE status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL
  `).get();
  const mttr = mttrRow?.mttr ? parseFloat(mttrRow.mttr).toFixed(2) : null;

  // MTBF (jours)
  const mtbfRow = db.prepare(`
    SELECT AVG(days_between) as mtbf FROM (
      SELECT julianday(failure_date) - julianday(LAG(failure_date) OVER (ORDER BY failure_date)) as days_between
      FROM work_orders WHERE failure_date IS NOT NULL AND status = 'completed'
    ) WHERE days_between > 0
  `).get();
  const mtbf = mtbfRow?.mtbf ? parseFloat(mtbfRow.mtbf).toFixed(2) : null;

  // OEE simplifié (disponibilité seule, perf=qualité=100%)
  const oee = parseFloat(availabilityRate);

  // Coût maintenance période (pièces + main d'œuvre estimée)
  let rate = 45;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hourly_rate');
    if (r?.value) rate = parseFloat(r.value);
  } catch (_) {}
  const costRow = db.prepare(`
    SELECT 
      COALESCE(SUM(i.quantity_used * sp.unit_price), 0) as parts,
      COALESCE(SUM(i.hours_spent), 0) as hours
    FROM work_orders wo
    LEFT JOIN interventions i ON i.work_order_id = wo.id
    LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
    WHERE wo.status = 'completed' AND wo.actual_end >= ${since}
  `).get();
  const partsCost = costRow?.parts || 0;
  const laborCost = (costRow?.hours || 0) * rate;
  const totalCost = partsCost + laborCost;

  // Taux respect plans préventifs (exécutés à temps)
  const prevRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN date(last_execution_date) <= date(next_due_date, '+7 days') OR last_execution_date IS NULL THEN 1 ELSE 0 END) as onTime
    FROM maintenance_plans WHERE is_active = 1
  `).get();
  const prevTotal = prevRow?.total || 0;
  const preventiveRate = prevTotal > 0 ? ((prevRow.onTime / prevTotal) * 100).toFixed(2) : 100;

  // OT en retard (SLA dépassé)
  const backlogRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM work_orders
    WHERE status IN ('pending', 'in_progress') AND sla_deadline IS NOT NULL AND datetime(sla_deadline) < datetime('now')
  `).get();
  const slaBreached = backlogRow?.cnt || 0;

  res.json({
    availabilityRate: parseFloat(availabilityRate),
    oee: parseFloat(oee),
    mttr: mttr ? parseFloat(mttr) : null,
    mtbf: mtbf ? parseFloat(mtbf) : null,
    totalEquipment: total,
    operationalCount: operational.c,
    totalCostPeriod: parseFloat((totalCost).toFixed(2)),
    partsCost: parseFloat((partsCost).toFixed(2)),
    laborCost: parseFloat((laborCost).toFixed(2)),
    preventiveComplianceRate: parseFloat(preventiveRate),
    slaBreached
  });
});

/**
 * GET /api/dashboard/charts
 * Données pour graphiques
 */
router.get('/charts', (req, res) => {
  const workOrdersByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM work_orders
    GROUP BY status
  `).all();

  const workOrdersByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM work_orders
    WHERE status IN ('pending', 'in_progress')
    GROUP BY priority
  `).all();

  const maintenanceByType = db.prepare(`
    SELECT t.name, COUNT(wo.id) as count
    FROM work_orders wo
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    WHERE wo.created_at >= date('now', '-30 days')
    GROUP BY t.name
  `).all();

  // OT par semaine (30 derniers jours) pour graphique évolution
  const weeklyOT = db.prepare(`
    SELECT strftime('%Y-%W', created_at) as week, status, COUNT(*) as count
    FROM work_orders
    WHERE created_at >= date('now', '-30 days')
    GROUP BY week, status
  `).all();

  res.json({
    byStatus: workOrdersByStatus,
    byPriority: workOrdersByPriority,
    byType: maintenanceByType,
    weeklyOT
  });
});

/**
 * GET /api/dashboard/alerts
 * Alertes : stock bas, SLA dépassé, plans en retard
 */
router.get('/alerts', (req, res) => {
  const stockAlerts = db.prepare(`
    SELECT sp.id, sp.code, sp.name, COALESCE(sb.quantity, 0) as stock_quantity, sp.min_stock
    FROM spare_parts sp
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE COALESCE(sb.quantity, 0) <= sp.min_stock
    ORDER BY COALESCE(sb.quantity, 0) ASC
    LIMIT 10
  `).all();

  const slaAlerts = db.prepare(`
    SELECT wo.id, wo.number, wo.title, wo.priority, wo.sla_deadline, wo.status, e.name as equipment_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    WHERE wo.status IN ('pending', 'in_progress') AND wo.sla_deadline IS NOT NULL
      AND datetime(wo.sla_deadline) < datetime('now')
    ORDER BY wo.priority = 'critical' DESC
    LIMIT 10
  `).all();

  const overduePlans = db.prepare(`
    SELECT mp.id, mp.name, mp.next_due_date, e.code, e.name as equipment_name
    FROM maintenance_plans mp
    JOIN equipment e ON mp.equipment_id = e.id
    WHERE mp.is_active = 1 AND mp.next_due_date < date('now')
    ORDER BY mp.next_due_date ASC
    LIMIT 10
  `).all();

  res.json({ stock: stockAlerts, sla: slaAlerts, overduePlans });
});

/**
 * GET /api/dashboard/top-failures
 * Top équipements en panne (récurrence)
 */
router.get('/top-failures', (req, res) => {
  const { limit = 5 } = req.query;
  const rows = db.prepare(`
    SELECT e.id, e.code, e.name, COUNT(wo.id) as failure_count
    FROM work_orders wo
    JOIN equipment e ON wo.equipment_id = e.id
    WHERE wo.status = 'completed' AND wo.failure_date IS NOT NULL
      AND wo.created_at >= date('now', '-90 days')
    GROUP BY wo.equipment_id
    ORDER BY failure_count DESC
    LIMIT ?
  `).all(parseInt(limit) || 5);
  res.json(rows);
});

/**
 * GET /api/dashboard/summary
 * Résumé des entités pour accès rapide et indicateurs liés aux sections
 */
router.get('/summary', (req, res) => {
  const period = parseInt(req.query.period, 10) || 30;
  const since = `date('now', '-${period} days')`;

  let sitesCount = 0;
  let departementsCount = 0;
  let lignesCount = 0;
  try {
    sitesCount = db.prepare('SELECT COUNT(*) as c FROM sites').get().c;
    lignesCount = db.prepare('SELECT COUNT(*) as c FROM lignes').get().c;
    try {
      departementsCount = db.prepare('SELECT COUNT(*) as c FROM departements').get().c;
    } catch (_) {}
  } catch (_) {}

  const equipmentCount = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status != "retired"').get().c;
  const equipmentOperational = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status = "operational"').get().c;
  const workOrdersPending = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('pending').c;
  const workOrdersInProgress = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('in_progress').c;
  const workOrdersCompletedPeriod = db.prepare(`
    SELECT COUNT(*) as c FROM work_orders WHERE status = 'completed' AND date(actual_end) >= ${since}
  `).get().c;
  const workOrdersCreatedPeriod = db.prepare(`
    SELECT COUNT(*) as c FROM work_orders WHERE date(created_at) >= ${since}
  `).get().c;

  let maintenancePlansActive = 0;
  let maintenancePlansOverdue = 0;
  try {
    maintenancePlansActive = db.prepare('SELECT COUNT(*) as c FROM maintenance_plans WHERE is_active = 1').get().c;
    maintenancePlansOverdue = db.prepare(`
      SELECT COUNT(*) as c FROM maintenance_plans WHERE is_active = 1 AND next_due_date < date('now')
    `).get().c;
  } catch (_) {}

  let stockPartsCount = 0;
  let stockAlertsCount = 0;
  try {
    stockPartsCount = db.prepare('SELECT COUNT(*) as c FROM spare_parts').get().c;
    stockAlertsCount = db.prepare(`
      SELECT COUNT(*) as c FROM spare_parts sp
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      WHERE COALESCE(sb.quantity, 0) <= sp.min_stock
    `).get().c;
  } catch (_) {}

  let suppliersCount = 0;
  let toolsCount = 0;
  try {
    suppliersCount = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
  } catch (_) {}
  try {
    toolsCount = db.prepare('SELECT COUNT(*) as c FROM tools').get().c;
  } catch (_) {}

  // Interventions (heures) sur la période
  let interventionsHours = 0;
  let interventionsCount = 0;
  try {
    const inter = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(i.hours_spent), 0) as hrs
      FROM interventions i
      JOIN work_orders wo ON i.work_order_id = wo.id
      WHERE wo.status = 'completed' AND date(wo.actual_end) >= ${since}
    `).get();
    interventionsCount = inter?.cnt || 0;
    interventionsHours = inter?.hrs || 0;
  } catch (_) {}

  res.json({
    sitesCount,
    departementsCount,
    lignesCount,
    equipmentCount,
    equipmentOperational,
    workOrdersPending,
    workOrdersInProgress,
    workOrdersCompletedPeriod,
    workOrdersCreatedPeriod,
    maintenancePlansActive,
    maintenancePlansOverdue,
    stockPartsCount,
    stockAlertsCount,
    suppliersCount,
    toolsCount,
    interventionsCount,
    interventionsHours: parseFloat(Number(interventionsHours).toFixed(2))
  });
});

/**
 * GET /api/dashboard/recent
 * Activité récente
 */
router.get('/recent', (req, res) => {
  const recentWO = db.prepare(`
    SELECT wo.id, wo.number, wo.title, wo.status, wo.priority, wo.created_at, e.name as equipment_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    ORDER BY wo.created_at DESC
    LIMIT 10
  `).all();
  const byId = new Map();
  recentWO.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
  res.json([...byId.values()]);
});

/**
 * GET /api/dashboard/activity
 * Alias pour activité récente (format liste d’activités)
 */
router.get('/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT wo.id, wo.number as work_order_number, wo.title, wo.description, wo.status, wo.priority, wo.created_at,
           e.name as equipment_name, u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    ORDER BY wo.created_at DESC
    LIMIT 20
  `).all();
  const activities = rows.map(r => ({
    id: r.id,
    type: 'work_order',
    title: r.title,
    description: r.description || r.equipment_name || '',
    status: r.status,
    created_at: r.created_at,
    work_order_number: r.work_order_number,
    equipment_name: r.equipment_name,
    assigned_name: r.assigned_name
  }));
  res.json(activities);
});

module.exports = router;
