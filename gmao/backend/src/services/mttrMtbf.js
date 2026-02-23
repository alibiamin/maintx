/**
 * Calculs professionnels MTTR et MTBF (normes maintenance)
 *
 * MTTR (Mean Time To Repair) = temps moyen de réparation
 *   Formule : Total temps de réparation / Nombre de réparations
 *   Périmètre : OT correctifs uniquement (failure_date ou type Correctif),
 *   avec actual_end > actual_start.
 *
 * MTBF (Mean Time Between Failures) = temps moyen entre deux pannes
 *   Formule : Moyenne des intervalles entre deux dates de panne consécutives, par équipement.
 *   Périmètre : OT avec failure_date ; PARTITION BY equipment_id pour ne pas mélanger les actifs.
 */

function repairOnlyCondition(alias = 'wo') {
  const a = alias;
  return `(
    ${a}.failure_date IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM work_order_types t
      WHERE t.id = ${a}.type_id AND (LOWER(TRIM(t.name)) LIKE '%correctif%' OR LOWER(TRIM(t.name)) LIKE '%corrective%')
    )
  )`;
}

/**
 * MTTR en heures. options: { since (SQL expr ou date), equipmentId, siteId }
 * @returns {{ mttrHours: number|null, repairCount: number }}
 */
function getMttr(db, options = {}) {
  if (!db) return { mttrHours: null, repairCount: 0 };
  const { since, equipmentId, siteId } = options;
  let where = `
    wo.status = 'completed'
    AND wo.actual_start IS NOT NULL
    AND wo.actual_end IS NOT NULL
    AND (julianday(wo.actual_end) - julianday(wo.actual_start)) > 0
    AND ${repairOnlyCondition('wo')}
  `;
  const params = [];
  if (since != null && since !== '') {
    if (typeof since === 'string' && (since.startsWith('date(') || since.includes("'now'"))) {
      where += ` AND date(wo.actual_end) >= ${since}`;
    } else {
      where += ' AND date(wo.actual_end) >= ?';
      params.push(since);
    }
  }
  if (equipmentId != null) {
    where += ' AND wo.equipment_id = ?';
    params.push(equipmentId);
  }
  if (siteId != null) {
    where += ' AND wo.equipment_id IN (SELECT e.id FROM equipment e JOIN lignes l ON e.ligne_id = l.id WHERE l.site_id = ?)';
    params.push(siteId);
  }
  const joinClause = siteId != null ? ' JOIN equipment e ON wo.equipment_id = e.id JOIN lignes l ON e.ligne_id = l.id' : '';
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) as repair_count,
        SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) as total_hours
      FROM work_orders wo
      ${joinClause}
      WHERE ${where}
    `).get(...params);
    const count = Number(row?.repair_count) || 0;
    const totalHours = Number(row?.total_hours) || 0;
    const mttrHours = count > 0 ? totalHours / count : null;
    return {
      mttrHours: mttrHours != null ? Math.round(mttrHours * 100) / 100 : null,
      repairCount: count
    };
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      return { mttrHours: null, repairCount: 0 };
    }
    throw e;
  }
}

/**
 * MTBF en jours. options: { since, equipmentId, siteId }. since = expression SQL ou date.
 * @returns {{ mtbfDays: number|null, intervalCount: number }}
 */
function getMtbf(db, options = {}) {
  if (!db) return { mtbfDays: null, intervalCount: 0 };
  const { since, equipmentId, siteId } = options;
  let extraWhere = 'wo.failure_date IS NOT NULL AND wo.status = \'completed\' AND wo.equipment_id IS NOT NULL';
  const params = [];
  if (since != null && since !== '') {
    if (typeof since === 'string' && (since.startsWith('date(') || since.includes("'now'"))) {
      extraWhere += ` AND date(wo.failure_date) >= ${since}`;
    } else {
      extraWhere += ' AND date(wo.failure_date) >= ?';
      params.push(since);
    }
  }
  if (equipmentId != null) {
    extraWhere += ' AND wo.equipment_id = ?';
    params.push(equipmentId);
  }
  if (siteId != null) {
    extraWhere += ' AND wo.equipment_id IN (SELECT e.id FROM equipment e JOIN lignes l ON e.ligne_id = l.id WHERE l.site_id = ?)';
    params.push(siteId);
  }
  const joinClause = siteId != null ? ' JOIN equipment e ON wo.equipment_id = e.id JOIN lignes l ON e.ligne_id = l.id' : '';
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) as interval_count,
        SUM(days_between) as total_days
      FROM (
        SELECT
          julianday(wo.failure_date) - julianday(LAG(wo.failure_date) OVER (PARTITION BY wo.equipment_id ORDER BY wo.failure_date)) as days_between
        FROM work_orders wo
        ${joinClause}
        WHERE ${extraWhere}
      ) WHERE days_between > 0
    `).get(...params);
    const intervalCount = Number(row?.interval_count) || 0;
    const totalDays = Number(row?.total_days) || 0;
    const mtbfDays = intervalCount > 0 ? totalDays / intervalCount : null;
    return {
      mtbfDays: mtbfDays != null ? Math.round(mtbfDays * 100) / 100 : null,
      intervalCount
    };
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      return { mtbfDays: null, intervalCount: 0 };
    }
    throw e;
  }
}

module.exports = {
  getMttr,
  getMtbf,
  repairOnlyCondition
};
