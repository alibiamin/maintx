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
  const total = equipment.total || 1;
  // Disponibilité : équipements opérationnels sans OT en cours (pending / in_progress)
  const available = db.prepare(`
    SELECT COUNT(*) as c FROM equipment e
    WHERE e.status = 'operational'
      AND e.id NOT IN (SELECT equipment_id FROM work_orders WHERE status IN ('pending', 'in_progress') AND equipment_id IS NOT NULL)
  `).get();
  const availabilityRate = ((available.c / total) * 100).toFixed(2);

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

  // Coût maintenance période (pièces + main d'œuvre par technicien)
  // Période : OT clôturés dont la date de fin (actual_end) est dans les N derniers jours
  let defaultRate = 45;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hourly_rate');
    if (r?.value) defaultRate = parseFloat(r.value);
  } catch (_) {}

  // Pièces : somme (quantité × prix unitaire) pour les interventions des OT complétés dans la période
  const partsRow = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(i.quantity_used, 0) * COALESCE(sp.unit_price, 0)), 0) as parts
    FROM work_orders wo
    LEFT JOIN interventions i ON i.work_order_id = wo.id
    LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
    WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}
  `).get();
  const partsCost = Number(partsRow?.parts) || 0;

  // Main d'œuvre : heures × taux horaire (technicien ou défaut) pour les interventions des OT complétés dans la période
  const interventionRows = db.prepare(`
    SELECT i.hours_spent, u.hourly_rate
    FROM work_orders wo
    JOIN interventions i ON i.work_order_id = wo.id
    LEFT JOIN users u ON i.technician_id = u.id
    WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}
  `).all();
  let laborCost = interventionRows.reduce((sum, row) => {
    const hours = parseFloat(row.hours_spent) || 0;
    const rate = row.hourly_rate != null && row.hourly_rate !== '' ? parseFloat(row.hourly_rate) : defaultRate;
    return sum + hours * rate;
  }, 0);

  // Complément : OT clôturés dans la période sans interventions (ou sans heures) → durée réelle × taux du technicien assigné
  const woWithoutInterventions = db.prepare(`
    SELECT wo.id,
           (julianday(wo.actual_end) - julianday(wo.actual_start)) * 24 as duration_hours,
           u.hourly_rate
    FROM work_orders wo
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND wo.actual_start IS NOT NULL
      AND date(wo.actual_end) >= ${since}
      AND NOT EXISTS (SELECT 1 FROM interventions i WHERE i.work_order_id = wo.id AND COALESCE(i.hours_spent, 0) > 0)
  `).all();
  woWithoutInterventions.forEach((row) => {
    const hours = parseFloat(row.duration_hours) || 0;
    if (hours <= 0) return;
    const rate = row.hourly_rate != null && row.hourly_rate !== '' ? parseFloat(row.hourly_rate) : defaultRate;
    laborCost += hours * rate;
  });

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
    operationalCount: available.c,
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
 * Escalade SLA (Flow) : notifier les responsables pour les OT dont le SLA est dépassé (une fois par OT)
 */
function runSlaEscalation() {
  try {
    const slaBreached = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.priority, wo.sla_deadline, e.name as equipment_name
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.status IN ('pending', 'in_progress') AND wo.sla_deadline IS NOT NULL
        AND datetime(wo.sla_deadline) < datetime('now')
        AND wo.id NOT IN (SELECT work_order_id FROM sla_escalation_log)
    `).all();
    const responsibles = db.prepare(`
      SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
    `).all().map((u) => u.id);
    const insertLog = db.prepare('INSERT OR IGNORE INTO sla_escalation_log (work_order_id) VALUES (?)');
    const notificationService = require('../services/notificationService');
    for (const wo of slaBreached) {
      insertLog.run(wo.id);
      notificationService.notify('sla_breached', responsibles, {
        number: wo.number,
        title: wo.title,
        priority: wo.priority,
        equipment_name: wo.equipment_name
      }).catch(() => {});
    }
  } catch (e) {
    if (e.message && !e.message.includes('no such table')) console.warn('[dashboard] SLA escalation:', e.message);
  }
}

/**
 * Vérification des seuils IoT (heures/cycles) : comparaison compteurs vs equipment_thresholds, création alerte et optionnellement OT
 */
function runThresholdCheck() {
  try {
    const thresholds = db.prepare(`
      SELECT t.*, e.code as equipment_code, e.name as equipment_name
      FROM equipment_thresholds t
      JOIN equipment e ON t.equipment_id = e.id
      WHERE t.metric IN ('hours', 'cycles')
    `).all();
    const counters = db.prepare('SELECT equipment_id, counter_type, value FROM equipment_counters').all();
    const counterByEquip = {};
    counters.forEach((c) => {
      if (!counterByEquip[c.equipment_id]) counterByEquip[c.equipment_id] = {};
      counterByEquip[c.equipment_id][c.counter_type] = c.value;
    });
    const now = new Date().toISOString().slice(0, 19);
    for (const t of thresholds) {
      const current = (counterByEquip[t.equipment_id] && counterByEquip[t.equipment_id][t.metric]) != null
        ? parseFloat(counterByEquip[t.equipment_id][t.metric])
        : null;
      if (current == null) continue;
      const th = parseFloat(t.threshold_value);
      const op = t.operator || '>=';
      let breached = false;
      if (op === '>=') breached = current >= th;
      else if (op === '>') breached = current > th;
      else if (op === '<=') breached = current <= th;
      else if (op === '<') breached = current < th;
      else if (op === '=') breached = current === th;
      else if (op === '!=') breached = current !== th;
      if (!breached) continue;
      const lastTriggered = t.last_triggered_at ? new Date(t.last_triggered_at).getTime() : 0;
      if (Date.now() - lastTriggered < 86400000) continue;
      db.prepare('UPDATE equipment_thresholds SET last_triggered_at = ? WHERE id = ?').run(now, t.id);
      const responsibles = db.prepare(`
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
      `).all().map((u) => u.id);
      const title = `Seuil ${t.metric} dépassé : ${t.equipment_code || t.equipment_name}`;
      const message = `Valeur actuelle : ${current}. Seuil : ${op} ${th}.`;
      responsibles.forEach((uid) => {
        try {
          db.prepare(`
            INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id, target_user_id)
            VALUES ('custom', 'warning', ?, ?, 'equipment', ?, ?)
          `).run(title, message, t.equipment_id, uid);
        } catch (_) {}
      });
    }
  } catch (e) {
    if (e.message && !e.message.includes('no such table')) console.warn('[dashboard] threshold check:', e.message);
  }
}

/**
 * GET /api/dashboard/alerts
 * Alertes : stock bas, SLA dépassé, plans en retard, seuils IoT. Déclenche escalade SLA et vérification seuils.
 */
router.get('/alerts', (req, res) => {
  runSlaEscalation();
  runThresholdCheck();
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
 * GET /api/dashboard/technician-performance
 * Performance des techniciens sur la période : OT complétés (interventions + assignation), heures passées
 */
router.get('/technician-performance', (req, res) => {
  const period = parseInt(req.query.period, 10) || 30;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const since = `date('now', '-${period} days')`;

  // 1) Techniciens ayant des interventions sur des OT complétés dans la période
  const fromInterventions = db.prepare(`
    SELECT u.id,
           COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.email, 'Technicien') as technician_name,
           COUNT(DISTINCT wo.id) as completed_wo_count,
           COALESCE(SUM(i.hours_spent), 0) as hours_spent
    FROM users u
    INNER JOIN interventions i ON i.technician_id = u.id
    INNER JOIN work_orders wo ON i.work_order_id = wo.id
      AND wo.status = 'completed'
      AND wo.actual_end IS NOT NULL
      AND date(wo.actual_end) >= ${since}
    GROUP BY u.id
    HAVING COUNT(DISTINCT wo.id) > 0
  `).all();

  // 2) Techniciens assignés (assigned_to) sur des OT complétés dans la période, sans intervention enregistrée
  const fromAssigned = db.prepare(`
    SELECT u.id,
           COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.email, 'Technicien') as technician_name,
           COUNT(DISTINCT wo.id) as completed_wo_count,
           COALESCE(SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24), 0) as hours_spent
    FROM work_orders wo
    INNER JOIN users u ON u.id = wo.assigned_to
    WHERE wo.status = 'completed'
      AND wo.actual_end IS NOT NULL
      AND wo.actual_start IS NOT NULL
      AND date(wo.actual_end) >= ${since}
      AND wo.assigned_to IS NOT NULL
    GROUP BY wo.assigned_to
  `).all();

  const byId = new Map();
  fromInterventions.forEach((r) => {
    byId.set(r.id, {
      id: r.id,
      technician_name: r.technician_name,
      completed_wo_count: r.completed_wo_count,
      hours_spent: parseFloat(Number(r.hours_spent).toFixed(2))
    });
  });
  fromAssigned.forEach((r) => {
    if (!byId.has(r.id)) {
      byId.set(r.id, {
        id: r.id,
        technician_name: r.technician_name,
        completed_wo_count: r.completed_wo_count,
        hours_spent: parseFloat(Number(r.hours_spent).toFixed(2))
      });
    }
  });

  const out = [...byId.values()]
    .sort((a, b) => b.completed_wo_count - a.completed_wo_count || b.hours_spent - a.hours_spent)
    .slice(0, limit);

  res.json(out);
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
router.get('/analytics', (req, res) => {
  const period = parseInt(req.query.period, 10) || 30;
  const since = `date('now', '-${period} days')`;
  let mttrByWeek = [];
  let costsByEquipment = [];
  try {
    mttrByWeek = db.prepare(`
      SELECT strftime('%Y-%W', wo.actual_end) as week,
             AVG((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) as mttr_hours
      FROM work_orders wo
      WHERE wo.status = 'completed' AND wo.actual_start IS NOT NULL AND wo.actual_end IS NOT NULL
        AND date(wo.actual_end) >= ${since}
      GROUP BY week ORDER BY week
    `).all();
  } catch (_) {}
  try {
    costsByEquipment = db.prepare(`
      SELECT e.id, e.code, e.name,
             COALESCE(SUM(COALESCE(i.quantity_used, 0) * COALESCE(sp.unit_price, 0)), 0) as parts_cost,
             COALESCE(SUM(i.hours_spent * 45), 0) as labor_cost
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN interventions i ON i.work_order_id = wo.id
      LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
      WHERE wo.status = 'completed' AND date(wo.actual_end) >= ${since}
      GROUP BY wo.equipment_id
      HAVING (parts_cost + labor_cost) > 0
      ORDER BY (parts_cost + labor_cost) DESC LIMIT 10
    `).all();
  } catch (_) {}
  res.json({
    mttrByWeek: mttrByWeek.map((r) => ({ week: r.week, mttrHours: r.mttr_hours != null ? parseFloat(Number(r.mttr_hours).toFixed(2)) : null })),
    costsByEquipment: costsByEquipment.map((r) => ({
      equipmentId: r.id, code: r.code, name: r.name,
      partsCost: parseFloat(Number(r.parts_cost).toFixed(2)),
      laborCost: parseFloat(Number(r.labor_cost).toFixed(2)),
      totalCost: parseFloat(Number(Number(r.parts_cost) + Number(r.labor_cost)).toFixed(2))
    }))
  });
});

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
