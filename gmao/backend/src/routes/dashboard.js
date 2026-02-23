/**
 * API Tableau de bord - KPIs et statistiques
 */

const express = require('express');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const getWorkOrderCosts = require('./workOrders').getWorkOrderCosts;
const { getIndicatorTargets, getTargetByKey, getStatusForKey } = require('../services/indicatorTargets');
const { getMttr, getMtbf } = require('../services/mttrMtbf');

const router = express.Router();
router.use(authenticate);

// SLA en heures par priorité (Coswin-like)
const SLA_HOURS = { critical: 2, high: 8, medium: 24, low: 72 };

function isMissingTable(e) {
  return e && e.message && (e.message.includes('no such table') || e.message.includes('no such column'));
}

/**
 * GET /api/dashboard/kpis
 * KPIs professionnels : Disponibilité, OEE (simplifié), MTTR, MTBF, coûts, SLA
 */
router.get('/kpis', (req, res) => {
  try {
    return getKpis(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({
        availabilityRate: 100,
        oee: 100,
        mttr: null,
        mtbf: null,
        totalEquipment: 0,
        operationalCount: 0,
        totalCostPeriod: 0,
        partsCost: 0,
        laborCost: 0,
        subcontractCost: 0,
        workOrdersCompletedPeriod: 0,
        preventiveComplianceRate: 100,
        slaBreached: 0,
        indicatorTargets: [],
        indicatorStatuses: { availability: 'ok', preventive_compliance: 'ok', sla_breached: 'ok', budget_period: 'ok', mttr: 'ok', mtbf: 'ok' }
      });
    }
    throw e;
  }
});

function getKpis(req, res) {
  const db = req.db;
  const { period = 30 } = req.query; // jours
  const periodDays = parseInt(period, 10) || 30;
  const since = `date('now', 'localtime', '-${periodDays} days')`;

  const equipment = db.prepare('SELECT COUNT(*) as total FROM equipment WHERE status != "retired"').get();
  const total = equipment.total || 1;
  // Disponibilité : équipements opérationnels sans OT en cours (pending / in_progress)
  const available = db.prepare(`
    SELECT COUNT(*) as c FROM equipment e
    WHERE e.status = 'operational'
      AND e.id NOT IN (SELECT equipment_id FROM work_orders WHERE status IN ('pending', 'in_progress') AND equipment_id IS NOT NULL)
  `).get();
  const availabilityRate = ((available.c / total) * 100).toFixed(2);

  // MTTR (heures) : temps moyen de réparation — OT correctifs uniquement, durée réelle (actual_end > actual_start)
  const mttrResult = getMttr(db, { since: `date('now', 'localtime', '-${periodDays} days')` });
  const mttr = mttrResult.mttrHours != null ? String(mttrResult.mttrHours) : null;

  // MTBF (jours) : temps moyen entre deux pannes — par équipement (failure_date), intervalles consécutifs
  const mtbfResult = getMtbf(db, { since: `date('now', 'localtime', '-${periodDays} days')` });
  const mtbf = mtbfResult.mtbfDays != null ? String(mtbfResult.mtbfDays) : null;

  // OEE simplifié (disponibilité seule, perf=qualité=100%)
  const oee = parseFloat(availabilityRate);

  // Coût période = somme des coûts totaux de chaque OT clôturé dans la période + sous-traitance
  // Période : actual_end ou completed_at dans les N derniers jours (date en local pour cohérence)
  let woIdsInPeriod = [];
  try {
    const sql = `
      SELECT wo.id FROM work_orders wo
      WHERE wo.status = 'completed'
        AND (
          (wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since})
          OR (wo.completed_at IS NOT NULL AND date(wo.completed_at) >= ${since})
        )
    `;
    woIdsInPeriod = db.prepare(sql).all();
  } catch (e) {
    if (e.message && e.message.includes('no such column') && e.message.includes('completed_at')) {
      woIdsInPeriod = db.prepare(`
        SELECT id FROM work_orders
        WHERE status = 'completed' AND actual_end IS NOT NULL AND date(actual_end) >= ${since}
      `).all();
    } else throw e;
  }
  let partsCost = 0;
  let laborCost = 0;
  let totalWOCost = 0;
  const processedWoIds = new Set();
  if (typeof getWorkOrderCosts === 'function') {
    for (const row of woIdsInPeriod || []) {
      const woId = row.id ?? row.ID ?? row['wo.id'] ?? (Object.keys(row || {}).length ? row[Object.keys(row)[0]] : null);
      if (woId == null || processedWoIds.has(Number(woId))) continue;
      processedWoIds.add(Number(woId));
      try {
        const costs = getWorkOrderCosts(db, woId);
        if (costs) {
          partsCost += Number(costs.partsCost) || 0;
          laborCost += Number(costs.laborCost) || 0;
          totalWOCost += Number(costs.totalCost) || 0;
        }
      } catch (_) {}
    }
  }
  let subcontractCost = 0;
  try {
    let subRow = db.prepare(`
      SELECT COALESCE(SUM(so.amount), 0) as sub_total
      FROM subcontract_orders so
      INNER JOIN work_orders wo ON so.work_order_id = wo.id
      WHERE wo.status = 'completed' AND (date(wo.actual_end) >= ${since} OR (wo.completed_at IS NOT NULL AND date(wo.completed_at) >= ${since}))
        AND COALESCE(so.amount, 0) > 0
    `).get();
    subcontractCost = Number(subRow?.sub_total) || 0;
  } catch (e) {
    if (e.message && e.message.includes('completed_at')) {
      try {
        const subRow = db.prepare(`
          SELECT COALESCE(SUM(so.amount), 0) as sub_total
          FROM subcontract_orders so
          INNER JOIN work_orders wo ON so.work_order_id = wo.id
          WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}
            AND COALESCE(so.amount, 0) > 0
        `).get();
        subcontractCost = Number(subRow?.sub_total) || 0;
      } catch (_) {}
    }
  }
  const totalCost = totalWOCost + subcontractCost;

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

  // Nombre d'OT clôturés dans la période (même filtre que le coût)
  let workOrdersCompletedPeriod = 0;
  try {
    const woCount = db.prepare(`
      SELECT COUNT(*) as c FROM work_orders
      WHERE status = 'completed'
        AND ((actual_end IS NOT NULL AND date(actual_end) >= ${since}) OR (completed_at IS NOT NULL AND date(completed_at) >= ${since}))
    `).get();
    workOrdersCompletedPeriod = woCount?.c ?? 0;
  } catch (e) {
    if (e.message && e.message.includes('completed_at')) {
      try {
        const woCount = db.prepare(`SELECT COUNT(*) as c FROM work_orders WHERE status = 'completed' AND actual_end IS NOT NULL AND date(actual_end) >= ${since}`).get();
        workOrdersCompletedPeriod = woCount?.c ?? 0;
      } catch (_) {}
    }
  }

  let indicatorTargets = [];
  try {
    indicatorTargets = getIndicatorTargets(db);
  } catch (_) {}

  const targetByKey = {};
  (indicatorTargets || []).forEach((t) => { targetByKey[t.key] = t; });
  const getTarget = (k) => targetByKey[k];
  const indicatorStatuses = {
    availability: getStatusForKey('availability', parseFloat(availabilityRate), getTarget('availability')),
    preventive_compliance: getStatusForKey('preventive_compliance', parseFloat(preventiveRate), getTarget('preventive_compliance')),
    sla_breached: getStatusForKey('sla_breached', slaBreached, getTarget('sla_breached')),
    budget_period: getStatusForKey('budget_period', parseFloat((totalCost).toFixed(2)), getTarget('budget_period')),
    mttr: getStatusForKey('mttr', mttr ? parseFloat(mttr) : null, getTarget('mttr')),
    mtbf: getStatusForKey('mtbf', mtbf ? parseFloat(mtbf) : null, getTarget('mtbf'))
  };

  return res.json({
    availabilityRate: parseFloat(availabilityRate),
    oee: parseFloat(oee),
    mttr: mttr ? parseFloat(mttr) : null,
    mtbf: mtbf ? parseFloat(mtbf) : null,
    totalEquipment: total,
    operationalCount: available.c,
    totalCostPeriod: parseFloat((totalCost).toFixed(2)),
    partsCost: parseFloat((partsCost).toFixed(2)),
    laborCost: parseFloat((laborCost).toFixed(2)),
    subcontractCost: parseFloat((subcontractCost).toFixed(2)),
    workOrdersCompletedPeriod,
    preventiveComplianceRate: parseFloat(preventiveRate),
    slaBreached,
    indicatorTargets,
    indicatorStatuses
  });
}

/**
 * GET /api/dashboard/charts
 * Données pour graphiques
 */
router.get('/charts', (req, res) => {
  try {
    return getCharts(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({ byStatus: [], byPriority: [], byType: [], evolutionOT: [], evolutionGranularity: 'week', evolutionPeriodDays: 30 });
    }
    throw e;
  }
});

function getCharts(req, res) {
  const db = req.db;
  const periodDays = Math.min(365, Math.max(7, parseInt(req.query.period, 10) || 30));
  const since = `date('now', 'localtime', '-${periodDays} days')`;

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
    WHERE wo.created_at >= ${since}
    GROUP BY t.name
  `).all();

  // Évolution des OT dans le temps : par jour (≤ 31 j) ou par semaine (> 31 j), avec statut
  const useDaily = periodDays <= 31;
  let evolutionOT = [];
  try {
    if (useDaily) {
      evolutionOT = db.prepare(`
        SELECT date(created_at) as period_key, status, COUNT(*) as count
        FROM work_orders
        WHERE created_at >= ${since}
        GROUP BY period_key, status
        ORDER BY period_key
      `).all();
    } else {
      evolutionOT = db.prepare(`
        SELECT strftime('%Y-%W', created_at) as period_key, status, COUNT(*) as count
        FROM work_orders
        WHERE created_at >= ${since}
        GROUP BY period_key, status
        ORDER BY period_key
      `).all();
    }
  } catch (_) {}

  return res.json({
    byStatus: workOrdersByStatus,
    byPriority: workOrdersByPriority,
    byType: maintenanceByType,
    evolutionOT,
    evolutionGranularity: useDaily ? 'day' : 'week',
    evolutionPeriodDays: periodDays
  });
}

/**
 * Escalade SLA (Flow) : notifier les responsables pour les OT dont le SLA est dépassé (une fois par OT)
 * @param {object} db - req.db
 * @param {number|null} tenantId - req.tenantId pour résolution des users (multi-tenant)
 */
function runSlaEscalation(db, tenantId) {
  if (!db) return;
  try {
    const slaBreached = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.priority, wo.sla_deadline, e.name as equipment_name
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.status IN ('pending', 'in_progress') AND wo.sla_deadline IS NOT NULL
        AND datetime(wo.sla_deadline) < datetime('now')
        AND wo.id NOT IN (SELECT work_order_id FROM sla_escalation_log)
    `).all();
    let responsibles;
    if (tenantId != null) {
      const dbModule = require('../database/db');
      const adminDb = dbModule.getAdminDb();
      try {
        responsibles = adminDb.prepare(`
          SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
          WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('responsable_maintenance', 'administrateur')
        `).all(tenantId).map((u) => u.id);
      } catch (e) {
        if (e.message && e.message.includes('no such column')) {
          responsibles = adminDb.prepare(`
            SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
          `).all().map((u) => u.id);
        } else throw e;
      }
    } else {
      responsibles = db.prepare(`
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('responsable_maintenance', 'administrateur')
      `).all().map((u) => u.id);
    }
    const insertLog = db.prepare('INSERT OR IGNORE INTO sla_escalation_log (work_order_id) VALUES (?)');
    const notificationService = require('../services/notificationService');
    for (const wo of slaBreached) {
      insertLog.run(wo.id);
      notificationService.notify(db, 'sla_breached', responsibles, {
        number: wo.number,
        title: wo.title,
        priority: wo.priority,
        equipment_name: wo.equipment_name
      }, tenantId).catch(() => {});
    }
  } catch (e) {
    if (e.message && !e.message.includes('no such table')) console.warn('[dashboard] SLA escalation:', e.message);
  }
}

/**
 * Vérification des seuils IoT (heures/cycles) : comparaison compteurs vs equipment_thresholds, création alerte et optionnellement OT
 */
function runThresholdCheck(db) {
  if (!db) return;
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
  try {
    return getAlerts(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({ stock: [], sla: [], overduePlans: [] });
    }
    throw e;
  }
});

function getAlerts(req, res) {
  const db = req.db;
  runSlaEscalation(db, req.tenantId);
  runThresholdCheck(db);
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

  return res.json({ stock: stockAlerts, sla: slaAlerts, overduePlans });
}

/**
 * GET /api/dashboard/top-failures
 * Top équipements en panne (récurrence)
 */
router.get('/top-failures', (req, res) => {
  try {
    const db = req.db;
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
    return res.json(rows);
  } catch (e) {
    if (isMissingTable(e)) return res.json([]);
    throw e;
  }
});

/**
 * GET /api/dashboard/wo-by-entity
 * Répartition du nombre d'OT par statut pour chaque Site, Département, Ligne, Équipement
 */
router.get('/wo-by-entity', (req, res) => {
  try {
    return getWoByEntity(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({ bySite: [], byDepartment: [], byLigne: [], byEquipment: [] });
    }
    throw e;
  }
});

function getWoByEntity(req, res) {
  const db = req.db;
  const statuses = ['pending', 'in_progress', 'completed', 'cancelled', 'deferred'];
  const statusCases = statuses.map((s) => `SUM(CASE WHEN wo.status = '${s}' THEN 1 ELSE 0 END) as ${s}`).join(', ');
  const totalExpr = `SUM(1) as total`;

  let bySite = [];
  try {
    const rows = db.prepare(`
      SELECT
        COALESCE(l.site_id, d.site_id) as site_id,
        s.code as site_code,
        s.name as site_name,
        ${statusCases},
        ${totalExpr}
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN departements d ON e.department_id = d.id
      LEFT JOIN sites s ON s.id = COALESCE(l.site_id, d.site_id)
      GROUP BY COALESCE(l.site_id, d.site_id), s.id, s.code, s.name
    `).all();
    bySite = rows.map((r) => ({
      siteId: r.site_id,
      siteCode: r.site_code || '',
      siteName: r.site_name || 'Sans affectation',
      pending: r.pending || 0,
      in_progress: r.in_progress || 0,
      completed: r.completed || 0,
      cancelled: r.cancelled || 0,
      deferred: r.deferred || 0,
      total: r.total || 0
    }));
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) throw e;
  }

  let byDepartment = [];
  try {
    const rows = db.prepare(`
      SELECT
        d.id as department_id,
        d.code as department_code,
        d.name as department_name,
        s.name as site_name,
        ${statusCases},
        ${totalExpr}
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      JOIN departements d ON e.department_id = d.id
      LEFT JOIN sites s ON d.site_id = s.id
      GROUP BY d.id, d.code, d.name, s.name
      ORDER BY total DESC
    `).all();
    byDepartment = rows.map((r) => ({
      departmentId: r.department_id,
      departmentCode: r.department_code || '',
      departmentName: r.department_name || '',
      siteName: r.site_name || '',
      pending: r.pending || 0,
      in_progress: r.in_progress || 0,
      completed: r.completed || 0,
      cancelled: r.cancelled || 0,
      deferred: r.deferred || 0,
      total: r.total || 0
    }));
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) throw e;
  }

  let byLigne = [];
  try {
    const rows = db.prepare(`
      SELECT
        l.id as ligne_id,
        l.code as ligne_code,
        l.name as ligne_name,
        s.name as site_name,
        ${statusCases},
        ${totalExpr}
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN sites s ON l.site_id = s.id
      GROUP BY l.id, l.code, l.name, s.name
      ORDER BY total DESC
    `).all();
    byLigne = rows.map((r) => ({
      ligneId: r.ligne_id,
      ligneCode: r.ligne_code || '',
      ligneName: r.ligne_name || '',
      siteName: r.site_name || '',
      pending: r.pending || 0,
      in_progress: r.in_progress || 0,
      completed: r.completed || 0,
      cancelled: r.cancelled || 0,
      deferred: r.deferred || 0,
      total: r.total || 0
    }));
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) throw e;
  }

  let byEquipment = [];
  try {
    const rows = db.prepare(`
      SELECT
        e.id as equipment_id,
        e.code as equipment_code,
        e.name as equipment_name,
        l.name as ligne_name,
        d.name as department_name,
        ${statusCases},
        ${totalExpr}
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN departements d ON e.department_id = d.id
      GROUP BY e.id, e.code, e.name, l.name, d.name
      ORDER BY total DESC
      LIMIT 50
    `).all();
    byEquipment = rows.map((r) => ({
      equipmentId: r.equipment_id,
      equipmentCode: r.equipment_code || '',
      equipmentName: r.equipment_name || '',
      ligneName: r.ligne_name || '',
      departmentName: r.department_name || '',
      pending: r.pending || 0,
      in_progress: r.in_progress || 0,
      completed: r.completed || 0,
      cancelled: r.cancelled || 0,
      deferred: r.deferred || 0,
      total: r.total || 0
    }));
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) throw e;
  }

  return res.json({ bySite, byDepartment, byLigne, byEquipment });
}

/**
 * GET /api/dashboard/cost-by-entity
 * Répartition du coût total des OT (période) par Site, Département, Ligne, Équipement
 * Query: period (jours, défaut 30)
 */
router.get('/cost-by-entity', (req, res) => {
  try {
    return getCostByEntity(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({ bySite: [], byDepartment: [], byLigne: [], byEquipment: [], period: req.query.period || 30 });
    }
    throw e;
  }
});

function getCostByEntity(req, res) {
  const db = req.db;
  const period = parseInt(req.query.period, 10) || 30;
  const since = `date('now', 'localtime', '-${period} days')`;

  let woRows = [];
  try {
    woRows = db.prepare(`
      SELECT wo.id as wo_id, wo.equipment_id,
             e.ligne_id, e.department_id,
             l.site_id as site_id_from_ligne,
             d.site_id as site_id_from_dept
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN departements d ON e.department_id = d.id
      WHERE wo.status = 'completed'
        AND ((wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}) OR (wo.completed_at IS NOT NULL AND date(wo.completed_at) >= ${since}))
    `).all();
  } catch (e) {
    if (e.message && e.message.includes('no such column') && e.message.includes('completed_at')) {
      woRows = db.prepare(`
        SELECT wo.id as wo_id, wo.equipment_id,
               e.ligne_id, e.department_id,
               l.site_id as site_id_from_ligne,
               d.site_id as site_id_from_dept
        FROM work_orders wo
        LEFT JOIN equipment e ON wo.equipment_id = e.id
        LEFT JOIN lignes l ON e.ligne_id = l.id
        LEFT JOIN departements d ON e.department_id = d.id
        WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}
      `).all();
    } else throw e;
  }

  const costBySite = { _na: 0 };
  const costByLigne = {};
  const costByDepartment = {};
  const costByEquipment = {};
  const processedWoIds = new Set();

  const getCosts = typeof getWorkOrderCosts === 'function' ? getWorkOrderCosts : null;
  for (const row of woRows || []) {
    const woId = row.wo_id ?? row.wo_ID ?? row['wo_id'] ?? (row && Object.keys(row).length ? row[Object.keys(row)[0]] : null);
    if (woId == null || processedWoIds.has(Number(woId))) continue;
    processedWoIds.add(Number(woId));
    let cost = 0;
    if (getCosts) {
      try {
        const c = getCosts(db, woId);
        cost = c && c.totalCost != null ? Number(c.totalCost) : 0;
      } catch (_) {}
    }
    const siteId = row.site_id_from_ligne ?? row.site_id_from_dept ?? null;
    if (siteId != null) costBySite[siteId] = (costBySite[siteId] || 0) + cost;
    else costBySite._na += cost;
    if (row.ligne_id != null) costByLigne[row.ligne_id] = (costByLigne[row.ligne_id] || 0) + cost;
    if (row.department_id != null) costByDepartment[row.department_id] = (costByDepartment[row.department_id] || 0) + cost;
    if (row.equipment_id != null) costByEquipment[row.equipment_id] = (costByEquipment[row.equipment_id] || 0) + cost;
  }

  let bySite = [];
  try {
    const sites = db.prepare('SELECT id, code, name FROM sites').all();
    bySite = sites.map((s) => ({
      siteId: s.id,
      siteCode: s.code || '',
      siteName: s.name || '',
      cost: Math.round((costBySite[s.id] || 0) * 100) / 100
    }));
    if (costBySite._na > 0) bySite.push({ siteId: null, siteCode: '', siteName: 'Sans affectation', cost: Math.round(costBySite._na * 100) / 100 });
    bySite = bySite.filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
  } catch (_) {}

  let byLigne = [];
  try {
    const lignes = db.prepare('SELECT l.id, l.code, l.name, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id').all();
    byLigne = lignes.map((l) => ({
      ligneId: l.id,
      ligneCode: l.code || '',
      ligneName: l.name || '',
      siteName: l.site_name || '',
      cost: Math.round((costByLigne[l.id] || 0) * 100) / 100
    })).filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
  } catch (_) {}

  let byDepartment = [];
  try {
    const deps = db.prepare('SELECT d.id, d.code, d.name, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id').all();
    byDepartment = deps.map((d) => ({
      departmentId: d.id,
      departmentCode: d.code || '',
      departmentName: d.name || '',
      siteName: d.site_name || '',
      cost: Math.round((costByDepartment[d.id] || 0) * 100) / 100
    })).filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
  } catch (_) {}

  let byEquipment = [];
  try {
    const equip = db.prepare(`
      SELECT e.id, e.code, e.name, l.name as ligne_name, d.name as department_name
      FROM equipment e
      LEFT JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN departements d ON e.department_id = d.id
    `).all();
    byEquipment = equip
      .map((e) => ({
        equipmentId: e.id,
        equipmentCode: e.code || '',
        equipmentName: e.name || '',
        ligneName: e.ligne_name || '',
        departmentName: e.department_name || '',
        cost: Math.round((costByEquipment[e.id] || 0) * 100) / 100
      }))
      .filter((r) => r.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 50);
  } catch (_) {}

  return res.json({ bySite, byDepartment, byLigne, byEquipment, period });
}

/**
 * GET /api/dashboard/decision-support
 * Analyse de l'état de la société selon indicateurs normés (EN 15341, bonnes pratiques)
 * et production d'observations, recommandations et aide à la décision pour la direction.
 * Query: period (jours, défaut 30)
 */
router.get('/decision-support', (req, res) => {
  try {
    return getDecisionSupport(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({
        period: parseInt(req.query.period, 10) || 30,
        generatedAt: new Date().toISOString(),
        currency: '€',
        indicators: [],
        observations: [],
        recommendations: [],
        priorities: [],
        decisionSupport: []
      });
    }
    throw e;
  }
});

function getDecisionSupport(req, res) {
  const db = req.db;
  const period = parseInt(req.query.period, 10) || 30;
  const since = `date('now', 'localtime', '-${period} days')`;

  const targetByKey = {};
  try {
    getIndicatorTargets(db).forEach(t => { targetByKey[t.key] = t; });
  } catch (_) {}
  let currency = '€';
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('currency');
    if (r?.value) currency = String(r.value).trim();
  } catch (_) {}

  const indicators = [];
  const observations = [];
  const recommendations = [];
  const priorities = [];
  const decisionSupport = [];

  let availabilityRate = 100;
  let totalEquipment = 1;
  let operationalCount = 0;
  let mttr = null;
  let mtbf = null;
  let totalCostPeriod = 0;
  let workOrdersCompletedPeriod = 0;
  let preventiveComplianceRate = 100;
  let slaBreached = 0;
  let workOrdersPending = 0;
  let workOrdersInProgress = 0;
  let maintenancePlansOverdue = 0;
  let maintenancePlansActive = 0;
  let stockAlertsCount = 0;
  let stockPartsCount = 0;

  try {
    const eq = db.prepare('SELECT COUNT(*) as total FROM equipment WHERE status != "retired"').get();
    totalEquipment = eq?.total || 1;
    const avail = db.prepare(`
      SELECT COUNT(*) as c FROM equipment e
      WHERE e.status = 'operational'
        AND e.id NOT IN (SELECT equipment_id FROM work_orders WHERE status IN ('pending', 'in_progress') AND equipment_id IS NOT NULL)
    `).get();
    operationalCount = avail?.c ?? 0;
    availabilityRate = totalEquipment > 0 ? Math.round((operationalCount / totalEquipment) * 10000) / 100 : 100;
  } catch (_) {}

  try {
    const mttrRes = getMttr(db, { since: `date('now', 'localtime', '-${period} days')` });
    mttr = mttrRes.mttrHours;
  } catch (_) {}
  try {
    const mtbfRes = getMtbf(db, { since: `date('now', 'localtime', '-${period} days')` });
    mtbf = mtbfRes.mtbfDays;
  } catch (_) {}

  try {
    const woCount = db.prepare(`
      SELECT COUNT(*) as c FROM work_orders
      WHERE status = 'completed'
        AND ((actual_end IS NOT NULL AND date(actual_end) >= ${since}) OR (completed_at IS NOT NULL AND date(completed_at) >= ${since}))
    `).get();
    workOrdersCompletedPeriod = woCount?.c ?? 0;
  } catch (e) {
    if (e.message && e.message.includes('no such column') && e.message.includes('completed_at')) {
      try {
        const woCount = db.prepare(`
          SELECT COUNT(*) as c FROM work_orders
          WHERE status = 'completed' AND actual_end IS NOT NULL AND date(actual_end) >= ${since}
        `).get();
        workOrdersCompletedPeriod = woCount?.c ?? 0;
      } catch (_) {}
    }
  }
  try {
    const prevRow = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN date(last_execution_date) <= date(next_due_date, '+7 days') OR last_execution_date IS NULL THEN 1 ELSE 0 END) as onTime
      FROM maintenance_plans WHERE is_active = 1
    `).get();
    const prevTotal = prevRow?.total || 0;
    preventiveComplianceRate = prevTotal > 0 ? Math.round((prevRow.onTime / prevTotal) * 10000) / 100 : 100;
  } catch (_) {}
  try {
    const slaRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM work_orders
      WHERE status IN ('pending', 'in_progress') AND sla_deadline IS NOT NULL AND datetime(sla_deadline) < datetime('now')
    `).get();
    slaBreached = slaRow?.cnt ?? 0;
  } catch (_) {}
  try {
    let woIds = [];
    try {
      woIds = db.prepare(`
        SELECT id FROM work_orders
        WHERE status = 'completed'
          AND ((actual_end IS NOT NULL AND date(actual_end) >= ${since}) OR (completed_at IS NOT NULL AND date(completed_at) >= ${since}))
      `).all();
    } catch (e) {
      if (e.message && e.message.includes('no such column') && e.message.includes('completed_at')) {
        woIds = db.prepare(`SELECT id FROM work_orders WHERE status = 'completed' AND actual_end IS NOT NULL AND date(actual_end) >= ${since}`).all();
      } else throw e;
    }
    const processed = new Set();
    for (const row of woIds || []) {
      const woId = row.id ?? row.ID ?? row['wo.id'];
      if (woId == null || processed.has(Number(woId))) continue;
      processed.add(Number(woId));
      if (typeof getWorkOrderCosts === 'function') {
        try {
          const c = getWorkOrderCosts(db, woId);
          if (c && c.totalCost != null) totalCostPeriod += Number(c.totalCost) || 0;
        } catch (_) {}
      }
    }
    let subRow = null;
    try {
      subRow = db.prepare(`
        SELECT COALESCE(SUM(so.amount), 0) as sub FROM subcontract_orders so
        INNER JOIN work_orders wo ON so.work_order_id = wo.id
        WHERE wo.status = 'completed' AND (date(wo.actual_end) >= ${since} OR (wo.completed_at IS NOT NULL AND date(wo.completed_at) >= ${since}))
          AND COALESCE(so.amount, 0) > 0
      `).get();
    } catch (e) {
      if (e.message && e.message.includes('no such column') && e.message.includes('completed_at')) {
        subRow = db.prepare(`
          SELECT COALESCE(SUM(so.amount), 0) as sub FROM subcontract_orders so
          INNER JOIN work_orders wo ON so.work_order_id = wo.id
          WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) >= ${since}
            AND COALESCE(so.amount, 0) > 0
        `).get();
      } else throw e;
    }
    totalCostPeriod += Number(subRow?.sub) || 0;
  } catch (_) {}
  try {
    const pending = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('pending');
    const inProgress = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('in_progress');
    workOrdersPending = pending?.c ?? 0;
    workOrdersInProgress = inProgress?.c ?? 0;
  } catch (_) {}
  try {
    const plans = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN date(next_due_date) < date('now', 'localtime') THEN 1 ELSE 0 END) as overdue
      FROM maintenance_plans WHERE is_active = 1
    `).get();
    maintenancePlansActive = plans?.total ?? 0;
    maintenancePlansOverdue = plans?.overdue ?? 0;
  } catch (_) {}
  try {
    const stock = db.prepare('SELECT COUNT(*) as c FROM spare_parts').get();
    stockPartsCount = stock?.c ?? 0;
    const alerts = db.prepare(`
      SELECT COUNT(*) as c FROM spare_parts sp
      LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
      WHERE COALESCE(sb.quantity, 0) < COALESCE(sp.min_stock, 0) AND COALESCE(sp.min_stock, 0) > 0
    `).get();
    stockAlertsCount = alerts?.c ?? 0;
  } catch (_) {}

  const backlogTotal = workOrdersPending + workOrdersInProgress;

  // Même ordre et libellés que le bandeau KPI du dashboard
  const t = (key, label, value, unit, refLabel, refVal, targetDirection) => {
    const target = targetByKey[key];
    const status = getStatusForKey(key, value, target);
    return {
      id: key,
      label,
      value,
      unit,
      ref: refVal != null ? refVal : (target && target.target_value),
      refLabel: refLabel || (target && target.ref_label) || '',
      targetDirection: (targetDirection != null ? targetDirection : (target && target.direction)) || null,
      status
    };
  };
  indicators.push(t('availability', 'Disponibilité', availabilityRate, '%', (targetByKey.availability && targetByKey.availability.ref_label) || 'Seuil min. (réf. EN 15341)', targetByKey.availability && targetByKey.availability.target_value, 'min'));
  const budgetTarget = targetByKey.budget_period;
  const costPeriodStatus = budgetTarget ? getStatusForKey('budget_period', totalCostPeriod, budgetTarget) : 'ok';
  indicators.push({
    id: 'cost_period',
    label: 'Coût période',
    value: totalCostPeriod,
    unit: currency,
    ref: budgetTarget ? budgetTarget.target_value : null,
    refLabel: budgetTarget ? (budgetTarget.ref_label || 'Budget période') : 'Suivi budgétaire',
    targetDirection: 'max',
    status: costPeriodStatus
  });
  indicators.push(t('mttr', 'MTTR moyen', mttr != null ? Math.round(mttr * 100) / 100 : null, 'h', (targetByKey.mttr && targetByKey.mttr.ref_label) || 'À minimiser', targetByKey.mttr && targetByKey.mttr.target_value, 'max'));
  indicators.push(t('mtbf', 'MTBF moyen', mtbf != null ? Math.round(mtbf * 100) / 100 : null, 'j', (targetByKey.mtbf && targetByKey.mtbf.ref_label) || 'À maximiser', targetByKey.mtbf && targetByKey.mtbf.target_value, 'min'));
  indicators.push(t('preventive_compliance', 'Respect préventif', preventiveComplianceRate, '%', (targetByKey.preventive_compliance && targetByKey.preventive_compliance.ref_label) || 'Objectif', targetByKey.preventive_compliance && targetByKey.preventive_compliance.target_value, 'min'));
  indicators.push(t('sla_breached', 'OT en dépassement SLA', slaBreached, '', (targetByKey.sla_breached && targetByKey.sla_breached.ref_label) || 'Objectif 0', targetByKey.sla_breached && targetByKey.sla_breached.target_value, 'max'));
  indicators.push(t('backlog', 'Backlog (en attente + en cours)', backlogTotal, 'OT', (targetByKey.backlog && targetByKey.backlog.ref_label) || 'À maîtriser', targetByKey.backlog && targetByKey.backlog.target_value, 'max'));
  indicators.push(t('overdue_plans', 'Plans préventifs en retard', maintenancePlansOverdue, '', (targetByKey.overdue_plans && targetByKey.overdue_plans.ref_label) || 'Objectif 0', targetByKey.overdue_plans && targetByKey.overdue_plans.target_value, 'max'));
  indicators.push(t('stock_alerts', 'Alertes stock (sous seuil)', stockAlertsCount, 'réf.', (targetByKey.stock_alerts && targetByKey.stock_alerts.ref_label) || 'Objectif 0', targetByKey.stock_alerts && targetByKey.stock_alerts.target_value, 'max'));
  indicators.push({ id: 'wo_completed', label: 'OT clôturés sur la période', value: workOrdersCompletedPeriod, unit: 'OT', ref: null, refLabel: 'Activité', targetDirection: null, status: 'ok' });

  const targetVal = (key) => (targetByKey[key] && targetByKey[key].target_value) ?? (key === 'availability' ? 85 : key === 'preventive_compliance' ? 90 : key === 'backlog' ? 10 : 0);
  const toSeverity = (s) => (s === 'attention' ? 'warning' : s === 'critical' ? 'critical' : 'info');
  if (availabilityRate < targetVal('availability')) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('availability', availabilityRate, targetByKey.availability)), text: `La disponibilité des équipements (${availabilityRate} %) est inférieure à l'objectif (${targetVal('availability')} %). ${totalEquipment - operationalCount} équipement(s) non disponible(s) (en maintenance ou OT en cours).` });
    recommendations.push({ category: 'disponibilité', text: 'Renforcer la maintenance préventive et analyser les pannes récurrentes pour réduire les temps d\'indisponibilité.' });
    priorities.push({ level: 'high', domain: 'Maintenance', action: 'Analyser les causes d\'indisponibilité et prioriser les interventions sur les équipements critiques.' });
  }
  if (mttr != null && (targetByKey.mttr ? mttr > targetByKey.mttr.target_value : mttr > 24)) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('mttr', mttr, targetByKey.mttr)), text: `Le MTTR moyen (${Math.round(mttr * 10) / 10} h) indique des temps de réparation élevés. Objectif : ${(targetByKey.mttr && targetByKey.mttr.target_value) || 24} h ou moins.` });
    recommendations.push({ category: 'efficacité', text: 'Optimiser la réactivité (pièces en stock, compétences, procédures) et formaliser les retours d\'expérience pour les pannes récurrentes.' });
  }
  if (mtbf != null && (targetByKey.mtbf ? mtbf < targetByKey.mtbf.target_value : mtbf < 30)) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('mtbf', mtbf, targetByKey.mtbf)), text: `Le MTBF moyen (${Math.round(mtbf * 10) / 10} j) reflète une fréquence de défaillances élevée. Objectif : ${(targetByKey.mtbf && targetByKey.mtbf.target_value) || 30} j ou plus.` });
    recommendations.push({ category: 'fiabilité', text: 'Renforcer les plans de maintenance préventive et l\'analyse des causes racines pour les équipements à faible MTBF.' });
  }
  if (preventiveComplianceRate < targetVal('preventive_compliance')) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('preventive_compliance', preventiveComplianceRate, targetByKey.preventive_compliance)), text: `Le taux de respect des plans préventifs (${preventiveComplianceRate} %) est en dessous de l'objectif (${targetVal('preventive_compliance')} %). ${maintenancePlansOverdue} plan(s) en retard.` });
    recommendations.push({ category: 'préventif', text: 'Replanifier les interventions préventives en retard et ajuster les fréquences ou les ressources pour tenir les échéances.' });
    priorities.push({ level: 'high', domain: 'Préventif', action: 'Traiter en priorité les plans préventifs en retard pour limiter les pannes évitables.' });
  }
  if (slaBreached > targetVal('sla_breached')) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('sla_breached', slaBreached, targetByKey.sla_breached)), text: `${slaBreached} ordre(s) de travail en dépassement du délai SLA. Risque pour la qualité de service et la satisfaction.` });
    recommendations.push({ category: 'réactivité', text: 'Affecter des ressources aux OT en retard et revoir les délais SLA si les capacités sont structurellement insuffisantes.' });
    priorities.push({ level: 'urgent', domain: 'SLA', action: 'Traiter immédiatement les OT dont le SLA est dépassé.' });
  }
  if (backlogTotal > targetVal('backlog')) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('backlog', backlogTotal, targetByKey.backlog)), text: `Le backlog (${backlogTotal} OT en attente ou en cours) dépasse l'objectif (${targetVal('backlog')}). Charge de travail à rééquilibrer.` });
    recommendations.push({ category: 'charge', text: 'Évaluer les capacités (effectifs, sous-traitance) et prioriser les OT selon criticité et délais.' });
    if (priorities.every(p => p.domain !== 'Backlog')) priorities.push({ level: 'medium', domain: 'Backlog', action: 'Réduire le backlog par priorisation et renfort temporaire si nécessaire.' });
  }
  if (maintenancePlansOverdue > (targetByKey.overdue_plans ? targetByKey.overdue_plans.target_value : 0)) {
    observations.push({ type: 'indicator', severity: 'warning', text: `${maintenancePlansOverdue} plan(s) de maintenance préventive en retard. Risque de dégradation de la fiabilité.` });
    if (!recommendations.some(r => r.category === 'préventif')) recommendations.push({ category: 'préventif', text: 'Replanifier et exécuter les visites préventives en retard.' });
  }
  if (stockAlertsCount > targetVal('stock_alerts')) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('stock_alerts', stockAlertsCount, targetByKey.stock_alerts)), text: `${stockAlertsCount} référence(s) en alerte stock (quantité sous seuil minimum). Risque de rupture pour les interventions.` });
    recommendations.push({ category: 'stock', text: 'Lancer les réapprovisionnements pour les pièces sous seuil et ajuster les niveaux min. si nécessaire.' });
    priorities.push({ level: stockAlertsCount > 5 ? 'urgent' : 'medium', domain: 'Stock', action: 'Traiter les alertes stock pour éviter les ruptures en intervention.' });
  }
  const budgetVal = targetByKey.budget_period ? targetByKey.budget_period.target_value : null;
  if (budgetVal != null && totalCostPeriod > budgetVal) {
    observations.push({ type: 'indicator', severity: toSeverity(getStatusForKey('budget_period', totalCostPeriod, targetByKey.budget_period)), text: `Le coût période (${totalCostPeriod.toLocaleString('fr-FR')} ${currency}) dépasse le budget défini (${Number(budgetVal).toLocaleString('fr-FR')} ${currency}).` });
    recommendations.push({ category: 'budget', text: 'Analyser les postes de coût (pièces, main d\'œuvre, sous-traitance) et prioriser les interventions pour rester dans l\'enveloppe budgétaire.' });
    priorities.push({ level: totalCostPeriod > budgetVal * 1.1 ? 'high' : 'medium', domain: 'Budget', action: 'Maîtriser les coûts de maintenance et revoir les engagements si nécessaire.' });
  }

  observations.push({ type: 'synthesis', severity: 'info', text: `Sur les ${period} derniers jours : ${workOrdersCompletedPeriod} ordre(s) de travail clôturé(s), coût période ${totalCostPeriod.toLocaleString('fr-FR')} ${currency}. ${totalEquipment} équipement(s) suivis, ${operationalCount} opérationnel(s).` });

  if (observations.filter(o => o.severity === 'critical').length > 0) {
    decisionSupport.push({ audience: 'direction', type: 'alert', text: 'Plusieurs indicateurs sont en zone critique. Une revue de la performance maintenance et des moyens (effectifs, stock, préventif) est recommandée.' });
  }
  if (recommendations.length > 0) {
    decisionSupport.push({ audience: 'direction', type: 'recommendation', text: 'Les recommandations listées ci-dessous, issues de l\'analyse des indicateurs normés, constituent un plan d\'actions priorisable pour la direction et les responsables maintenance.' });
  }
  if (priorities.some(p => p.level === 'urgent')) {
    decisionSupport.push({ audience: 'responsables', type: 'action', text: 'Actions urgentes identifiées (SLA dépassés, risques stock). À traiter en priorité par les responsables.' });
  }
  decisionSupport.push({ audience: 'direction', type: 'info', text: 'Ce rapport est établi selon les indicateurs de la norme EN 15341 (maintenance) et bonnes pratiques. Période d\'analyse : ' + period + ' jours. À utiliser en support des revues de direction et du pilotage de la maintenance.' });

  return res.json({
    period,
    generatedAt: new Date().toISOString(),
    currency,
    indicators,
    observations,
    recommendations,
    priorities,
    decisionSupport
  });
}

/**
 * GET /api/dashboard/summary
 * Résumé des entités pour accès rapide et indicateurs liés aux sections
 */
router.get('/summary', (req, res) => {
  try {
    return getSummary(req, res);
  } catch (e) {
    if (isMissingTable(e)) {
      return res.json({
        sitesCount: 0,
        departementsCount: 0,
        lignesCount: 0,
        equipmentCount: 0,
        equipmentOperational: 0,
        workOrdersPending: 0,
        workOrdersInProgress: 0,
        workOrdersCompletedPeriod: 0,
        workOrdersCreatedPeriod: 0,
        maintenancePlansActive: 0,
        maintenancePlansOverdue: 0,
        stockPartsCount: 0,
        stockAlertsCount: 0,
        suppliersCount: 0,
        toolsCount: 0,
        interventionsCount: 0,
        interventionsHours: 0
      });
    }
    throw e;
  }
});

function getSummary(req, res) {
  const db = req.db;
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

  let equipmentCount = 0;
  let equipmentOperational = 0;
  let workOrdersPending = 0;
  let workOrdersInProgress = 0;
  let workOrdersCompletedPeriod = 0;
  let workOrdersCreatedPeriod = 0;
  try {
    equipmentCount = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status != "retired"').get().c;
    equipmentOperational = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status = "operational"').get().c;
    workOrdersPending = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('pending').c;
    workOrdersInProgress = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE status = ?').get('in_progress').c;
    workOrdersCompletedPeriod = db.prepare(`
      SELECT COUNT(*) as c FROM work_orders WHERE status = 'completed' AND date(actual_end) >= ${since}
    `).get().c;
    workOrdersCreatedPeriod = db.prepare(`
      SELECT COUNT(*) as c FROM work_orders WHERE date(created_at) >= ${since}
    `).get().c;
  } catch (_) {}

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

  return res.json({
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
}

/**
 * GET /api/dashboard/technician-performance
 * Performance des techniciens sur la période : OT complétés (interventions + assignation), heures passées
 */
router.get('/technician-performance', (req, res) => {
  try {
    return getTechnicianPerformance(req, res);
  } catch (e) {
    if (isMissingTable(e)) return res.json([]);
    throw e;
  }
});

function getTechnicianPerformance(req, res) {
  const db = req.db;
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

  return res.json(out);
}

/**
 * GET /api/dashboard/recent
 * Activité récente
 */
router.get('/recent', (req, res) => {
  try {
    const db = req.db;
    const recentWO = db.prepare(`
    SELECT wo.id, wo.number, wo.title, wo.status, wo.priority, wo.created_at, e.name as equipment_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    ORDER BY wo.created_at DESC
    LIMIT 10
  `).all();
    const byId = new Map();
    recentWO.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
    return res.json([...byId.values()]);
  } catch (e) {
    if (isMissingTable(e)) return res.json([]);
    throw e;
  }
});

/**
 * GET /api/dashboard/activity
 * Alias pour activité récente (format liste d’activités)
 */
router.get('/analytics', (req, res) => {
  const db = req.db;
  const period = parseInt(req.query.period, 10) || 30;
  const since = `date('now', '-${period} days')`;
  let mttrByWeek = [];
  let costsByEquipment = [];
  try {
    const { repairOnlyCondition } = require('../services/mttrMtbf');
    mttrByWeek = db.prepare(`
      SELECT strftime('%Y-%W', wo.actual_end) as week,
             SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) / COUNT(*) as mttr_hours
      FROM work_orders wo
      WHERE wo.status = 'completed' AND wo.actual_start IS NOT NULL AND wo.actual_end IS NOT NULL
        AND (julianday(wo.actual_end) - julianday(wo.actual_start)) > 0
        AND ${repairOnlyCondition('wo')}
        AND date(wo.actual_end) >= ${since}
      GROUP BY strftime('%Y-%W', wo.actual_end) ORDER BY week
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
  try {
    const db = req.db;
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
    return res.json(activities);
  } catch (e) {
    if (isMissingTable(e)) return res.json([]);
    throw e;
  }
});

module.exports = router;
