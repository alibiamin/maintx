/**
 * Jobs planifiés : génération OT par compteur (maintenance_plans trigger_type=counter),
 * alertes seuils (equipment_thresholds) + option création OT
 */

const dbModule = require('../database/db');

function generateOTNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT number FROM work_orders WHERE number LIKE ? ORDER BY id DESC LIMIT 1').get(`OT-${year}-%`);
  const num = last ? parseInt(last.number.split('-')[2], 10) + 1 : 1;
  return `OT-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * Pour chaque plan avec trigger_type=counter dont le compteur >= threshold_value,
 * crée un OT et met à jour last_execution / next_due (ou remet le compteur à 0 selon config).
 */
function runCounterBasedPlanGeneration(clientDb) {
  if (!clientDb) return;
  try {
    const plans = clientDb.prepare(`
      SELECT mp.id, mp.equipment_id, mp.name, mp.procedure_id, mp.threshold_value, mp.counter_type,
             e.code as equipment_code, e.name as equipment_name
      FROM maintenance_plans mp
      JOIN equipment e ON mp.equipment_id = e.id
      JOIN equipment_counters ec ON ec.equipment_id = mp.equipment_id AND ec.counter_type = mp.counter_type
      WHERE mp.is_active = 1 AND mp.trigger_type = 'counter'
        AND mp.threshold_value IS NOT NULL AND ec.value >= mp.threshold_value
    `).all();
    const typePreventive = clientDb.prepare('SELECT id FROM work_order_types WHERE name LIKE ? OR name LIKE ?').get('%réventif%', '%reventif%');
    const typeId = typePreventive ? typePreventive.id : 1;
    for (const plan of plans) {
      const existing = clientDb.prepare('SELECT id FROM work_orders WHERE maintenance_plan_id = ? AND status NOT IN (?) ORDER BY id DESC LIMIT 1').get(plan.id, 'cancelled');
      if (existing) continue;
      const number = generateOTNumber(clientDb);
      const now = new Date().toISOString().slice(0, 19);
      const title = `[Compteur] ${plan.name} - ${plan.equipment_code || ''}`;
      const ir = clientDb.prepare(`
        INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, status, maintenance_plan_id, procedure_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'medium', 'pending', ?, ?, 1, ?)
      `).run(number, title, `Généré automatiquement (compteur ${plan.counter_type} >= ${plan.threshold_value})`, plan.equipment_id, typeId, plan.id, plan.procedure_id, now);
      const woId = ir.lastInsertRowid || clientDb.prepare('SELECT last_insert_rowid() as id').get().id;
      clientDb.prepare(`
        UPDATE maintenance_plans SET last_execution_date = date('now'), last_execution_work_order_id = ?, next_due_date = date('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(woId, plan.id);
      try {
        clientDb.prepare('UPDATE equipment_counters SET value = 0, updated_at = CURRENT_TIMESTAMP WHERE equipment_id = ? AND counter_type = ?').run(plan.equipment_id, plan.counter_type);
      } catch (_) {}
      if (clientDb._save) clientDb._save();
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('[scheduledJobs] counter plans:', e.message);
  }
}

/**
 * Pour chaque equipment_thresholds dépassé : crée une alerte ; si create_wo_on_breach=1, crée un OT.
 */
function runThresholdAlerts(clientDb) {
  if (!clientDb) return;
  try {
    const thresholds = clientDb.prepare(`
      SELECT et.id, et.equipment_id, et.metric, et.threshold_value, et.operator, et.create_wo_on_breach,
             e.code as equipment_code, e.name as equipment_name
      FROM equipment_thresholds et
      JOIN equipment e ON et.equipment_id = e.id
    `).all();
    const counters = clientDb.prepare('SELECT equipment_id, counter_type, value FROM equipment_counters').all();
    const byEq = {};
    counters.forEach((c) => {
      if (!byEq[c.equipment_id]) byEq[c.equipment_id] = {};
      byEq[c.equipment_id][c.counter_type] = c.value;
    });
    for (const t of thresholds) {
      const value = byEq[t.equipment_id] && (byEq[t.equipment_id][t.metric] != null) ? parseFloat(byEq[t.equipment_id][t.metric]) : null;
      if (value == null) continue;
      const breach = t.operator === 'gt' ? value > t.threshold_value : (t.operator === 'gte' ? value >= t.threshold_value : (t.operator === 'lt' ? value < t.threshold_value : value <= t.threshold_value));
      if (!breach) continue;
      try {
        const existing = clientDb.prepare(`
          SELECT id FROM alerts WHERE entity_type = 'equipment' AND entity_id = ? AND message LIKE ? AND date(created_at) = date('now')
        `).get(t.equipment_id, `%${t.metric}%`);
        if (existing) continue;
        clientDb.prepare(`
          INSERT INTO alerts (alert_type, severity, title, message, entity_type, entity_id)
          VALUES (?, ?, ?, ?, 'equipment', ?)
        `).run(
          'equipment_failure',
          'warning',
          'Seuil dépassé',
          `${t.equipment_code || ''} ${t.equipment_name || ''} : ${t.metric} = ${value} (seuil ${t.operator} ${t.threshold_value})`,
          t.equipment_id
        );
        if (t.create_wo_on_breach === 1) {
          const typeCorrective = clientDb.prepare('SELECT id FROM work_order_types WHERE name LIKE ? OR name LIKE ?').get('%orrectif%', '%orrectif%');
          const typeId = typeCorrective ? typeCorrective.id : 2;
          const number = generateOTNumber(clientDb);
          const title = `[Seuil] ${t.metric} - ${t.equipment_code || ''}`;
          clientDb.prepare(`
            INSERT INTO work_orders (number, title, description, equipment_id, type_id, priority, status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, 'high', 'pending', 1, datetime('now'))
          `).run(number, title, `Seuil ${t.metric} ${t.operator} ${t.threshold_value} (valeur: ${value})`, t.equipment_id, typeId);
        }
        if (clientDb._save) clientDb._save();
      } catch (err) {
        if (!err.message || !err.message.includes('no such table')) console.warn('[scheduledJobs] threshold', t.id, err.message);
      }
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('[scheduledJobs] thresholds:', e.message);
  }
}

function runAll(clientDb, tenantId) {
  runCounterBasedPlanGeneration(clientDb);
  runThresholdAlerts(clientDb);
}

module.exports = { runCounterBasedPlanGeneration, runThresholdAlerts, runAll };
