/**
 * API Rapports et statistiques - Export PDF/Excel
 */

const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { repairOnlyCondition } = require('../services/mttrMtbf');

function writePdfTable(doc, headers, rows, colWidths) {
  let y = doc.y;
  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, 50 + colWidths.slice(0, i).reduce((a, w) => a + w, 0), y));
  y += 18;
  doc.font('Helvetica');
  rows.forEach((row) => {
    const vals = Array.isArray(row) ? row : [];
    vals.forEach((val, i) => doc.text(String(val ?? '').substring(0, 35), 50 + colWidths.slice(0, i).reduce((a, w) => a + w, 0), y));
    y += 16;
  });
  doc.y = y + 10;
}

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/reports/maintenance-costs
 * Analyse des coûts de maintenance (main-d'œuvre + pièces) par équipement.
 * Filtres optionnels: siteId, equipmentId
 */
router.get('/maintenance-costs', (req, res) => {
  const db = req.db;
  const { startDate, endDate, siteId, equipmentId } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  let sql = `
    SELECT e.code, e.name, e.id as equipment_id, COUNT(DISTINCT wo.id) as interventions,
           SUM(COALESCE(i.quantity_used * sp.unit_price, 0)) as parts_cost,
           SUM(COALESCE(i.hours_spent * u_tech.hourly_rate, 0)) as labor_cost
    FROM work_orders wo
    JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN interventions i ON i.work_order_id = wo.id
    LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
    LEFT JOIN users u_tech ON i.technician_id = u_tech.id
    WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) BETWEEN ? AND ?
  `;
  const params = [start, end];
  if (siteId) {
    sql += ' AND e.ligne_id IN (SELECT id FROM lignes WHERE site_id = ?)';
    params.push(siteId);
  }
  if (equipmentId) {
    sql += ' AND e.id = ?';
    params.push(equipmentId);
  }
  sql += ' GROUP BY e.id ORDER BY (COALESCE(parts_cost,0) + COALESCE(labor_cost,0)) DESC';
  const byEquipment = db.prepare(sql).all(...params);
  res.json(byEquipment);
});

/**
 * GET /api/reports/mttr
 * MTTR (Mean Time To Repair) en heures — OT correctifs uniquement, durée réelle (actual_end > actual_start).
 */
router.get('/mttr', (req, res) => {
  const db = req.db;
  const { startDate, endDate, siteId, equipmentId } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  let where = `wo.status = 'completed' AND wo.actual_start IS NOT NULL AND wo.actual_end IS NOT NULL
    AND (julianday(wo.actual_end) - julianday(wo.actual_start)) > 0
    AND ${repairOnlyCondition('wo')}
    AND date(wo.actual_end) BETWEEN ? AND ?`;
  const params = [start, end];
  if (siteId) {
    where += ' AND e.ligne_id IN (SELECT id FROM lignes WHERE site_id = ?)';
    params.push(siteId);
  }
  if (equipmentId) {
    where += ' AND wo.equipment_id = ?';
    params.push(equipmentId);
  }
  let byEquipment = [];
  let global = null;
  try {
    byEquipment = db.prepare(`
    SELECT e.id as equipment_id, e.code, e.name,
           COUNT(wo.id) as repair_count,
           SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) / NULLIF(COUNT(*), 0) as mttr_hours
    FROM work_orders wo
    JOIN equipment e ON wo.equipment_id = e.id
    WHERE ${where}
    GROUP BY wo.equipment_id
    ORDER BY mttr_hours DESC
  `).all(...params);
    global = db.prepare(`
    SELECT COUNT(*) as repair_count,
           SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) / NULLIF(COUNT(*), 0) as mttr_hours
    FROM work_orders wo
    JOIN equipment e ON wo.equipment_id = e.id
    WHERE ${where}
  `).get(...params);
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      global = { repair_count: 0, mttr_hours: null };
    } else throw e;
  }
  res.json({ global: global || { repair_count: 0, mttr_hours: null }, byEquipment: byEquipment || [] });
});

/**
 * GET /api/reports/mtbf
 * MTBF (Mean Time Between Failures) — temps moyen entre deux pannes (failure_date), par équipement.
 * Retour en jours (j) pour cohérence avec le dashboard et les objectifs (MTBF ≥ X j).
 * Formule : moyenne des intervalles (failure_date[i] - failure_date[i-1]) par équipement, puis globale.
 */
router.get('/mtbf', (req, res) => {
  const db = req.db;
  const { startDate, endDate, siteId, equipmentId } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  let where = `wo.failure_date IS NOT NULL AND wo.status = 'completed' AND wo.equipment_id IS NOT NULL
    AND date(wo.failure_date) BETWEEN ? AND ?`;
  const params = [start, end];
  if (siteId) {
    where += ' AND e.ligne_id IN (SELECT id FROM lignes WHERE site_id = ?)';
    params.push(siteId);
  }
  if (equipmentId) {
    where += ' AND wo.equipment_id = ?';
    params.push(equipmentId);
  }
  let byEquipment = [];
  let globalRow = null;
  try {
    byEquipment = db.prepare(`
    WITH ordered AS (
      SELECT wo.equipment_id, wo.failure_date,
             LAG(wo.failure_date) OVER (PARTITION BY wo.equipment_id ORDER BY wo.failure_date) as prev_failure
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      WHERE ${where}
    )
    SELECT e.id as equipment_id, e.code, e.name,
           COUNT(*) as intervals,
           (SUM(julianday(o.failure_date) - julianday(o.prev_failure)) / NULLIF(COUNT(*), 0)) as mtbf_days
    FROM ordered o
    JOIN equipment e ON o.equipment_id = e.id
    WHERE o.prev_failure IS NOT NULL
    GROUP BY o.equipment_id
    ORDER BY mtbf_days DESC
  `).all(...params);
    globalRow = db.prepare(`
    WITH ordered AS (
      SELECT wo.equipment_id, wo.failure_date,
             LAG(wo.failure_date) OVER (PARTITION BY wo.equipment_id ORDER BY wo.failure_date) as prev_failure
      FROM work_orders wo
      JOIN equipment e ON wo.equipment_id = e.id
      WHERE ${where}
    ),
    intervals AS (
      SELECT (julianday(failure_date) - julianday(prev_failure)) as days_between
      FROM ordered WHERE prev_failure IS NOT NULL
    )
    SELECT COUNT(*) as intervals, (SUM(days_between) / NULLIF(COUNT(*), 0)) as mtbf_days FROM intervals
  `).get(...params);
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      globalRow = { intervals: 0, mtbf_days: null };
    } else throw e;
  }
  const global = globalRow || { intervals: 0, mtbf_days: null };
  const byEquipmentWithDays = (byEquipment || []).map((row) => ({
    ...row,
    mtbf_days: row.mtbf_days != null ? parseFloat(Number(row.mtbf_days).toFixed(4)) : null,
    mtbf_hours: row.mtbf_days != null ? parseFloat((row.mtbf_days * 24).toFixed(2)) : null
  }));
  res.json({
    global: {
      intervals: global.intervals ?? 0,
      mtbf_days: global.mtbf_days != null ? parseFloat(Number(global.mtbf_days).toFixed(4)) : null,
      mtbf_hours: global.mtbf_days != null ? parseFloat((global.mtbf_days * 24).toFixed(2)) : null
    },
    byEquipment: byEquipmentWithDays
  });
});

/**
 * GET /api/reports/cost-per-operating-hour
 * Coût de maintenance par heure de fonctionnement (utilise les compteurs équipement si présents).
 */
router.get('/cost-per-operating-hour', (req, res) => {
  const db = req.db;
  const { startDate, endDate, siteId, equipmentId } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  let costWhere = `wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) BETWEEN ? AND ?`;
  const costParams = [start, end];
  if (siteId) {
    costWhere += ' AND e.ligne_id IN (SELECT id FROM lignes WHERE site_id = ?)';
    costParams.push(siteId);
  }
  if (equipmentId) {
    costWhere += ' AND e.id = ?';
    costParams.push(equipmentId);
  }
  const costs = db.prepare(`
    SELECT e.id as equipment_id, e.code, e.name, e.target_cost_per_operating_hour,
           SUM(COALESCE(i.quantity_used * sp.unit_price, 0)) + SUM(COALESCE(i.hours_spent * u_tech.hourly_rate, 0)) as maintenance_cost
    FROM work_orders wo
    JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN interventions i ON i.work_order_id = wo.id
    LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
    LEFT JOIN users u_tech ON i.technician_id = u_tech.id
    WHERE ${costWhere}
    GROUP BY e.id
  `).all(...costParams);
  const counters = db.prepare(`
    SELECT equipment_id, counter_type, value FROM equipment_counters WHERE counter_type = 'hours'
  `).all();
  const counterByEq = new Map(counters.map(c => [c.equipment_id, c.value]));
  const result = costs.map(row => {
    const maintenanceCost = row.maintenance_cost || 0;
    const operatingHours = counterByEq.get(row.equipment_id) || null;
    const targetPerHour = row.target_cost_per_operating_hour != null ? Number(row.target_cost_per_operating_hour) : null;
    const totalCost = (targetPerHour != null && operatingHours != null && Number(operatingHours) > 0)
      ? targetPerHour * Number(operatingHours)
      : null;
    const actualCostPerHour = (operatingHours != null && Number(operatingHours) > 0)
      ? maintenanceCost / Number(operatingHours) : null;
    const costPerHour = targetPerHour != null ? targetPerHour : actualCostPerHour;
    return {
      equipment_id: row.equipment_id,
      code: row.code,
      name: row.name,
      total_cost: totalCost,
      maintenance_cost: maintenanceCost,
      target_cost_per_operating_hour: targetPerHour,
      operating_hours: operatingHours,
      cost_per_operating_hour: costPerHour
    };
  });
  res.json(result);
});

/**
 * GET /api/reports/availability
 * Disponibilité par équipement / période (filtres optionnels: siteId, equipmentId)
 */
router.get('/availability', (req, res) => {
  const db = req.db;
  const { startDate, endDate, siteId, equipmentId } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  let where = "e.status != 'retired'";
  const params = [start, end, start, end];
  if (siteId) {
    where += ' AND e.ligne_id IN (SELECT id FROM lignes WHERE site_id = ?)';
    params.push(siteId);
  }
  if (equipmentId) {
    where += ' AND e.id = ?';
    params.push(equipmentId);
  }
  const rows = db.prepare(`
    SELECT e.id, e.code, e.name, e.status,
           (SELECT COUNT(*) FROM work_orders w WHERE w.equipment_id = e.id AND w.status = 'completed'
            AND w.actual_end IS NOT NULL AND date(w.actual_end) BETWEEN ? AND ?) as intervention_count,
           (SELECT COALESCE(SUM((julianday(w.actual_end) - julianday(w.actual_start)) * 24), 0)
            FROM work_orders w WHERE w.equipment_id = e.id AND w.status = 'completed'
            AND w.actual_start IS NOT NULL AND w.actual_end IS NOT NULL AND date(w.actual_end) BETWEEN ? AND ?) as total_downtime_hours
    FROM equipment e
    WHERE ${where}
    ORDER BY total_downtime_hours DESC
  `).all(...params);
  res.json(rows);
});

/**
 * GET /api/reports/time-by-technician
 * Heures passées par technicien sur la période
 */
router.get('/time-by-technician', (req, res) => {
  const db = req.db;
  const { startDate, endDate } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  const rows = db.prepare(`
    SELECT u.id, u.first_name || ' ' || u.last_name as technician_name,
           COALESCE(SUM(i.hours_spent), 0) as hours_spent,
           COUNT(DISTINCT i.work_order_id) as work_orders_count
    FROM users u
    INNER JOIN interventions i ON i.technician_id = u.id
    INNER JOIN work_orders wo ON i.work_order_id = wo.id
      AND wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) BETWEEN ? AND ?
    GROUP BY u.id
    ORDER BY hours_spent DESC
  `).all(start, end);
  res.json(rows);
});

/**
 * GET /api/reports/parts-most-used
 * Pièces les plus utilisées sur la période
 */
router.get('/parts-most-used', (req, res) => {
  const db = req.db;
  const { startDate, endDate, limit } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  let rows;
  try {
    rows = db.prepare(`
      SELECT sp.code as part_code, sp.name as part_name,
             pf.code as part_family_code, pf.name as part_family_name,
             sl.code as location_code, sl.name as location_name,
             SUM(i.quantity_used) as quantity_used,
             SUM(i.quantity_used * sp.unit_price) as total_cost
      FROM interventions i
      JOIN spare_parts sp ON i.spare_part_id = sp.id
      LEFT JOIN part_families pf ON sp.part_family_id = pf.id
      LEFT JOIN stock_locations sl ON sp.location_id = sl.id
      JOIN work_orders wo ON i.work_order_id = wo.id
      WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) BETWEEN ? AND ?
      GROUP BY sp.id
      ORDER BY quantity_used DESC
      LIMIT ?
    `).all(start, end, lim);
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('no such table'))) {
      rows = db.prepare(`
        SELECT sp.code as part_code, sp.name as part_name,
               SUM(i.quantity_used) as quantity_used,
               SUM(i.quantity_used * sp.unit_price) as total_cost
        FROM interventions i
        JOIN spare_parts sp ON i.spare_part_id = sp.id
        JOIN work_orders wo ON i.work_order_id = wo.id
        WHERE wo.status = 'completed' AND wo.actual_end IS NOT NULL AND date(wo.actual_end) BETWEEN ? AND ?
        GROUP BY sp.id
        ORDER BY quantity_used DESC
        LIMIT ?
      `).all(start, end, lim);
    } else throw e;
  }
  res.json(rows);
});

/**
 * GET /api/reports/export/detailed
 * Export Excel détaillé (coûts, pièces, temps)
 */
router.get('/export/detailed', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), async (req, res) => {
  const db = req.db;
  const { startDate, endDate } = req.query;
  const start = startDate || '2020-01-01';
  const end = endDate || '2100-12-31';
  const rows = db.prepare(`
    SELECT wo.number, wo.title, wo.status, wo.priority, wo.failure_date, wo.actual_start, wo.actual_end,
           e.name as equipment_name, t.name as type_name,
           (SELECT SUM(i.hours_spent) FROM interventions i WHERE i.work_order_id = wo.id) as hours_spent,
           (SELECT SUM(i.quantity_used * sp.unit_price) FROM interventions i LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id WHERE i.work_order_id = wo.id) as parts_cost
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    WHERE wo.actual_end BETWEEN ? AND ? AND wo.status = 'completed'
    ORDER BY wo.actual_end DESC
  `).all(start, end);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rapport détaillé');
  let currency = '€';
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('currency');
    if (r?.value) currency = String(r.value).trim();
  } catch (_) {}
  sheet.columns = [
    { header: 'N° OT', key: 'number', width: 15 },
    { header: 'Titre', key: 'title', width: 35 },
    { header: 'Équipement', key: 'equipment_name', width: 25 },
    { header: 'Type', key: 'type_name', width: 15 },
    { header: 'Statut', key: 'status', width: 12 },
    { header: 'Heures', key: 'hours_spent', width: 10 },
    { header: `Coût pièces (${currency})`, key: 'parts_cost', width: 14 },
    { header: 'Date fin', key: 'actual_end', width: 18 }
  ];
  sheet.addRows(rows.map(r => ({ ...r, parts_cost: r.parts_cost ? parseFloat(r.parts_cost).toFixed(2) : 0 })));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rapport-detaille.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/reports/work-orders
 */
router.get('/work-orders', (req, res) => {
  const db = req.db;
  const { startDate, endDate, status } = req.query;
  let sql = `
    SELECT wo.*, e.name as equipment_name, t.name as type_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    WHERE wo.created_at BETWEEN ? AND ?
  `;
  const params = [startDate || '2020-01-01', endDate || '2100-12-31'];
  if (status) { sql += ' AND wo.status = ?'; params.push(status); }
  sql += ' ORDER BY wo.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

/**
 * GET /api/reports/export/excel
 * Export Excel des OT
 */
router.get('/export/excel', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), async (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT wo.number, wo.title, wo.status, wo.priority, wo.created_at, wo.actual_end,
           e.name as equipment_name, t.name as type_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    ORDER BY wo.created_at DESC
  `).all();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ordres de travail');
  sheet.columns = [
    { header: 'N° OT', key: 'number', width: 15 },
    { header: 'Titre', key: 'title', width: 35 },
    { header: 'Équipement', key: 'equipment_name', width: 25 },
    { header: 'Type', key: 'type_name', width: 15 },
    { header: 'Statut', key: 'status', width: 12 },
    { header: 'Priorité', key: 'priority', width: 10 },
    { header: 'Date création', key: 'created_at', width: 18 },
    { header: 'Date fin', key: 'actual_end', width: 18 }
  ];
  sheet.addRows(rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rapport-ot.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/reports/export/pdf/equipment - Liste des équipements en PDF
 */
router.get('/export/pdf/equipment', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT e.code, e.name, e.status, s.name as site_name
    FROM equipment e
    LEFT JOIN lignes l ON e.ligne_id = l.id
    LEFT JOIN sites s ON l.site_id = s.id
    ORDER BY s.name, e.code
  `).all();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=liste-equipements.pdf');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(16).text('Liste des équipements', 50, 50);
  doc.fontSize(10).text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - ${rows.length} équipement(s)`, 50, 75);
  doc.moveDown();
  writePdfTable(doc, ['Code', 'Désignation', 'Statut', 'Site'], rows.map(r => [r.code, r.name, r.status || '-', r.site_name || '-']), [70, 180, 60, 120]);
  doc.end();
});

/**
 * GET /api/reports/export/pdf/maintenance - Plans de maintenance en PDF
 */
router.get('/export/pdf/maintenance', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT e.code as equipment_code, e.name as equipment_name, mp.name as plan_name,
             mp.frequency_days, mp.next_due_date, p.name as procedure_name
      FROM maintenance_plans mp
      JOIN equipment e ON mp.equipment_id = e.id
      LEFT JOIN procedures p ON mp.procedure_id = p.id
      ORDER BY e.code, mp.name
    `).all();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      rows = db.prepare(`
        SELECT e.code as equipment_code, e.name as equipment_name, mp.name as plan_name,
               mp.frequency_days, mp.next_due_date
        FROM maintenance_plans mp
        JOIN equipment e ON mp.equipment_id = e.id
        ORDER BY e.code, mp.name
      `).all();
      rows = rows.map((r) => ({ ...r, procedure_name: null }));
    } else throw e;
  }
  const tableRows = rows.map((r) => [
    (r.equipment_code || '') + ' ' + (r.equipment_name || '-'),
    r.plan_name || '-',
    r.frequency_days != null ? `${r.frequency_days} j` : '-',
    r.next_due_date ? new Date(r.next_due_date).toLocaleDateString('fr-FR') : '-',
    r.procedure_name || '-'
  ]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=plans-maintenance.pdf');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(16).text('Plans de maintenance', 50, 50);
  doc.fontSize(10).text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - ${rows.length} plan(s)`, 50, 75);
  doc.moveDown();
  writePdfTable(doc, ['Équipement', 'Plan', 'Fréquence', 'Prochaine échéance', 'Procédure'], tableRows, [100, 120, 55, 55, 100]);
  doc.end();
});

/**
 * GET /api/reports/export/pdf/stock - État des stocks en PDF
 */
router.get('/export/pdf/stock', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT sp.code, sp.name, COALESCE(sb.quantity, 0) as quantity, sp.min_stock, sp.unit
    FROM spare_parts sp
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    ORDER BY sp.code
  `).all();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=etat-stocks.pdf');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(16).text('État des stocks', 50, 50);
  doc.fontSize(10).text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - ${rows.length} référence(s)`, 50, 75);
  doc.moveDown();
  writePdfTable(doc, ['Code', 'Désignation', 'Quantité', 'Seuil min', 'Unité'], rows.map(r => [r.code, r.name, r.quantity, r.min_stock, r.unit || '-']), [70, 180, 60, 70, 50]);
  doc.end();
});

/**
 * GET /api/reports/export/pdf/work-order/:id - Bon de travail (OT) en PDF
 */
router.get('/export/pdf/work-order/:id', (req, res) => {
  const db = req.db;
  const woId = req.params.id;
  const wo = db.prepare(`
    SELECT wo.*, e.name as equipment_name, e.code as equipment_code, t.name as type_name,
           u.first_name || ' ' || u.last_name as assigned_name,
           cb.first_name || ' ' || cb.last_name as created_by_name
    FROM work_orders wo
    LEFT JOIN equipment e ON wo.equipment_id = e.id
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    LEFT JOIN users cb ON wo.created_by = cb.id
    WHERE wo.id = ?
  `).get(woId);
  if (!wo) return res.status(404).json({ error: 'Ordre de travail non trouvé' });

  let interventions;
  try {
    interventions = db.prepare(`
      SELECT i.description, i.hours_spent, i.quantity_used, sp.code as part_code, sp.name as part_name, sp.unit_price,
             pf.name as part_family_name, sl.name as location_name,
             u.first_name || ' ' || u.last_name as technician_name
      FROM interventions i
      LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
      LEFT JOIN part_families pf ON sp.part_family_id = pf.id
      LEFT JOIN stock_locations sl ON sp.location_id = sl.id
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.work_order_id = ?
      ORDER BY i.id
    `).all(woId);
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('no such table'))) {
      interventions = db.prepare(`
        SELECT i.description, i.hours_spent, i.quantity_used, sp.code as part_code, sp.name as part_name, sp.unit_price,
               u.first_name || ' ' || u.last_name as technician_name
        FROM interventions i
        LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
        LEFT JOIN users u ON i.technician_id = u.id
        WHERE i.work_order_id = ?
        ORDER BY i.id
      `).all(woId);
      interventions = interventions.map(i => ({ ...i, part_family_name: null, location_name: null }));
    } else throw e;
  }

  const statusLabels = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé', deferred: 'Reporté' };
  const priorityLabels = { low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=bon-travail-${(wo.number || woId).replace(/\s/g, '-')}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  let y = 50;
  doc.fontSize(18).font('Helvetica-Bold').text('Bon de travail', 50, y);
  y += 28;
  doc.fontSize(11).font('Helvetica');
  doc.text(`N° ${wo.number || '-'}`, 50, y);
  doc.text(`Titre : ${(wo.title || '').substring(0, 60)}`, 50, y + 18);
  doc.text(`Équipement : ${(wo.equipment_code || '')} ${(wo.equipment_name || '-')}`.trim(), 50, y + 36);
  doc.text(`Type : ${wo.type_name || '-'}  |  Priorité : ${priorityLabels[wo.priority] || wo.priority}  |  Statut : ${statusLabels[wo.status] || wo.status}`, 50, y + 54);
  doc.text(`Planifié : ${wo.planned_start ? wo.planned_start.slice(0, 16) : '-'} → ${wo.planned_end ? wo.planned_end.slice(0, 16) : '-'}`, 50, y + 72);
  doc.text(`Assigné à : ${wo.assigned_name || '-'}  |  Créé par : ${wo.created_by_name || '-'}`, 50, y + 90);
  y += 110;

  if (wo.description) {
    doc.font('Helvetica-Bold').text('Description', 50, y);
    y += 18;
    doc.font('Helvetica').text((wo.description || '').substring(0, 500), 50, y, { width: 500 });
    y += 40;
  }

  doc.font('Helvetica-Bold').text('Interventions / Pièces utilisées', 50, y);
  y += 22;
  if (interventions.length === 0) {
    doc.font('Helvetica').text('Aucune intervention enregistrée.', 50, y);
    y += 24;
  } else {
    const hasFamilyLoc = interventions.some(i => i.part_family_name != null || i.location_name != null);
    const headers = hasFamilyLoc ? ['Technicien', 'Description', 'Heures', 'Pièce', 'Famille', 'Empl.', 'Qté', 'P.U.'] : ['Technicien', 'Description', 'Heures', 'Pièce', 'Qté', 'P.U.'];
    const xPos = hasFamilyLoc ? [50, 80, 160, 220, 300, 360, 400, 440] : [50, 100, 180, 260, 320, 380];
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, idx) => doc.text(h, xPos[idx], y));
    y += 16;
    doc.font('Helvetica');
    interventions.forEach((i) => {
      const line = hasFamilyLoc
        ? [i.technician_name || '-', (i.description || '').substring(0, 25), i.hours_spent != null ? `${i.hours_spent} h` : '-', i.part_name ? `${i.part_code || ''} ${i.part_name}`.trim().substring(0, 18) : '-', (i.part_family_name || '-').substring(0, 8), (i.location_name || '-').substring(0, 6), i.quantity_used ?? '-', i.unit_price != null ? `${Number(i.unit_price).toFixed(2)}` : '-']
        : [i.technician_name || '-', (i.description || '').substring(0, 35), i.hours_spent != null ? `${i.hours_spent} h` : '-', i.part_name ? `${i.part_code || ''} ${i.part_name}`.trim().substring(0, 28) : '-', i.quantity_used ?? '-', i.unit_price != null ? `${Number(i.unit_price).toFixed(2)}` : '-'];
      line.forEach((val, idx) => doc.text(String(val), xPos[idx], y));
      y += 16;
    });
    y += 8;
  }

  if (wo.status === 'completed' && (wo.completed_at || wo.signature_name)) {
    doc.font('Helvetica-Bold').text('Clôture', 50, y);
    y += 18;
    doc.font('Helvetica');
    if (wo.completed_at) doc.text(`Clôturé le : ${wo.completed_at.slice(0, 19)}`, 50, y);
    if (wo.signature_name) doc.text(`Signé par : ${wo.signature_name}`, 50, y + 18);
    y += 50;
  }

  doc.fontSize(9).text(`Document généré le ${new Date().toLocaleString('fr-FR')} - GMAO`, 50, doc.page.height - 40);
  doc.end();
});

/**
 * GET /api/reports/export/pdf/kpis - Indicateurs de performance en PDF
 */
router.get('/export/pdf/kpis', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const { startDate, endDate } = req.query;
  const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = endDate || new Date().toISOString().slice(0, 10);
  const woTotal = db.prepare('SELECT COUNT(*) as c FROM work_orders WHERE date(created_at) BETWEEN ? AND ?').get(start, end);
  const woCompleted = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status = 'completed' AND date(actual_end) BETWEEN ? AND ?").get(start, end);
  let mttrRow = null;
  let mtbfRow = null;
  try {
    mttrRow = db.prepare(`
      SELECT SUM((julianday(wo.actual_end) - julianday(wo.actual_start)) * 24) / COUNT(*) as mttr
      FROM work_orders wo
      WHERE wo.status = 'completed' AND wo.actual_start IS NOT NULL AND wo.actual_end IS NOT NULL
        AND (julianday(wo.actual_end) - julianday(wo.actual_start)) > 0
        AND ${repairOnlyCondition('wo')}
        AND date(wo.actual_end) BETWEEN ? AND ?
    `).get(start, end);
  } catch (_) {}
  try {
    mtbfRow = db.prepare(`
      WITH ordered AS (
        SELECT wo.equipment_id, wo.failure_date,
               LAG(wo.failure_date) OVER (PARTITION BY wo.equipment_id ORDER BY wo.failure_date) as prev_failure
        FROM work_orders wo
        WHERE wo.failure_date IS NOT NULL AND wo.status = 'completed' AND wo.equipment_id IS NOT NULL
          AND date(wo.failure_date) BETWEEN ? AND ?
      ),
      intervals AS ( SELECT (julianday(failure_date) - julianday(prev_failure)) as days_between FROM ordered WHERE prev_failure IS NOT NULL )
      SELECT SUM(days_between) / COUNT(*) as mtbf FROM intervals
    `).get(start, end);
  } catch (_) {}
  const eqCount = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE status != ?').get('retired');
  const alertCount = db.prepare(`
    SELECT COUNT(*) as c FROM spare_parts sp
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE COALESCE(sb.quantity, 0) <= sp.min_stock
  `).get();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=indicateurs-kpis.pdf');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(16).text('Indicateurs de performance', 50, 50);
  doc.fontSize(10).text(`Période du ${start} au ${end}`, 50, 75);
  doc.moveDown();
  doc.fontSize(11);
  doc.text(`OT créés (période) : ${woTotal?.c ?? 0}`, 50, doc.y);
  doc.text(`OT terminés (période) : ${woCompleted?.c ?? 0}`, 50, doc.y + 20);
  doc.text(`MTTR moyen (heures, correctifs) : ${mttrRow?.mttr != null ? parseFloat(mttrRow.mttr).toFixed(2) : '-'}`, 50, doc.y + 40);
  doc.text(`MTBF moyen (jours, pannes) : ${mtbfRow?.mtbf != null ? parseFloat(mtbfRow.mtbf).toFixed(2) : '-'}`, 50, doc.y + 60);
  doc.text(`Équipements actifs : ${eqCount?.c ?? 0}`, 50, doc.y + 80);
  doc.text(`Alertes stock (sous seuil) : ${alertCount?.c ?? 0}`, 50, doc.y + 100);
  doc.end();
});

module.exports = router;
