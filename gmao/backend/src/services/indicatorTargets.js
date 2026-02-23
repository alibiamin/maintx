/**
 * Objectifs des indicateurs (indicator_targets)
 * Utilisé par le dashboard KPIs, l'assistance à la décision et le paramétrage.
 */

const DEFAULTS = {
  availability: { target_value: 85, direction: 'min', unit: '%', ref_label: 'Seuil min. (réf. EN 15341)' },
  preventive_compliance: { target_value: 90, direction: 'min', unit: '%', ref_label: 'Objectif' },
  sla_breached: { target_value: 0, direction: 'max', unit: '', ref_label: 'Objectif 0' },
  backlog: { target_value: 10, direction: 'max', unit: 'OT', ref_label: 'À maîtriser' },
  overdue_plans: { target_value: 0, direction: 'max', unit: '', ref_label: 'Objectif 0' },
  stock_alerts: { target_value: 0, direction: 'max', unit: 'réf.', ref_label: 'Objectif 0' },
  mttr: { target_value: 24, direction: 'max', unit: 'h', ref_label: 'À minimiser' },
  mtbf: { target_value: 30, direction: 'min', unit: 'j', ref_label: 'À maximiser' },
  budget_period: { target_value: 50000, direction: 'max', unit: '', ref_label: 'Budget à ne pas dépasser' }
};

/**
 * Retourne tous les objectifs depuis la table indicator_targets (ou défauts si table absente).
 * @param {object} db - base (req.db)
 * @returns {Array<{key, label, target_value, direction, unit, ref_label, sort_order}>}
 */
function getIndicatorTargets(db) {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT key, label, target_value, direction, unit, ref_label, sort_order
      FROM indicator_targets
      ORDER BY sort_order ASC, key ASC
    `).all();
    return rows.map(r => ({
      key: r.key,
      label: r.label,
      target_value: Number(r.target_value),
      direction: r.direction || 'min',
      unit: r.unit || '',
      ref_label: r.ref_label || '',
      sort_order: r.sort_order ?? 0
    }));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return [];
    throw e;
  }
}

/**
 * Retourne un objet { key => target_value } pour usage rapide dans les calculs.
 * @param {object} db
 * @returns {Record<string, number>}
 */
function getTargetValues(db) {
  const list = getIndicatorTargets(db);
  const out = {};
  list.forEach(t => { out[t.key] = t.target_value; });
  Object.keys(DEFAULTS).forEach(k => { if (out[k] == null) out[k] = DEFAULTS[k].target_value; });
  return out;
}

/**
 * Retourne l'objectif pour une clé donnée (ligne complète ou défaut).
 */
function getTargetByKey(db, key) {
  const list = getIndicatorTargets(db);
  const found = list.find(t => t.key === key);
  if (found) return found;
  const def = DEFAULTS[key];
  if (!def) return null;
  return { key, label: key, ...def, sort_order: 0 };
}

/**
 * Calcule le statut (ok / attention / critical) par rapport à l'objectif.
 * @param {string} key - clé indicateur
 * @param {number|null} value - valeur actuelle
 * @param {object} target - { target_value, direction }
 * @returns {'ok'|'attention'|'critical'}
 */
function getStatusForKey(key, value, target) {
  if (value == null && key !== 'sla_breached' && key !== 'backlog' && key !== 'overdue_plans' && key !== 'stock_alerts') return 'ok';
  const t = target && target.target_value != null ? target.target_value : (DEFAULTS[key] && DEFAULTS[key].target_value);
  const dir = target && target.direction ? target.direction : (DEFAULTS[key] && DEFAULTS[key].direction) || 'min';
  if (t == null) return 'ok';
  const v = Number(value);
  if (dir === 'min') {
    if (v >= t) return 'ok';
    if (key === 'availability' && v >= 70) return 'attention';
    if (key === 'preventive_compliance' && v >= 70) return 'attention';
    if (key === 'mtbf' && v >= 7) return 'attention';
    return 'critical';
  }
  if (dir === 'max') {
    if (v <= t) return 'ok';
    if (key === 'sla_breached' && v <= 3) return 'attention';
    if (key === 'backlog' && v <= 20) return 'attention';
    if (key === 'stock_alerts' && v <= 5) return 'attention';
    if (key === 'mttr' && v <= 72) return 'attention';
    if (key === 'budget_period' && t > 0 && v <= t * 1.1) return 'attention';
    return 'critical';
  }
  return 'ok';
}

module.exports = { getIndicatorTargets, getTargetValues, getTargetByKey, getStatusForKey, DEFAULTS };
