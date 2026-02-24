/**
 * API Rapports planifiés — paramétrage et exécution par job
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

const REPORT_TYPES = [
  { key: 'maintenance-costs', label: 'Coûts de maintenance', defaultParams: {} },
  { key: 'work-orders', label: 'Liste des OT', defaultParams: {} },
  { key: 'export-detailed', label: 'Export détaillé (Excel)', defaultParams: {} },
  { key: 'kpis', label: 'Indicateurs KPI', defaultParams: {} }
];

function getNextRunAt(frequency, frequencyParam) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(7, 0, 0, 0);
      return next.toISOString().slice(0, 19);
    case 'weekly':
      const day = frequencyParam ? parseInt(frequencyParam, 10) : 1;
      const nextW = new Date(now);
      let diff = day - nextW.getDay();
      if (diff <= 0) diff += 7;
      nextW.setDate(nextW.getDate() + diff);
      nextW.setHours(7, 0, 0, 0);
      return nextW.toISOString().slice(0, 19);
    case 'monthly':
      const dayM = frequencyParam ? parseInt(frequencyParam, 10) : 1;
      const nextM = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dayM, 28), 7, 0, 0, 0);
      return nextM.toISOString().slice(0, 19);
    default:
      const nextD = new Date(now);
      nextD.setDate(nextD.getDate() + 1);
      nextD.setHours(7, 0, 0, 0);
      return nextD.toISOString().slice(0, 19);
  }
}

router.get('/types', (req, res) => {
  res.json(REPORT_TYPES);
});

router.get('/', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT id, report_type, frequency, frequency_param, recipient_emails, params_json, next_run_at, last_run_at, is_active, created_at
      FROM scheduled_reports
      ORDER BY next_run_at ASC
    `).all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Rapport planifié non trouvé' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Rapport planifié non trouvé' });
    throw e;
  }
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('reportType').notEmpty().trim(),
  body('frequency').isIn(['daily', 'weekly', 'monthly']),
  body('frequencyParam').optional().trim(),
  body('recipientEmails').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { reportType, frequency, frequencyParam, recipientEmails, paramsJson } = req.body;
  const validType = REPORT_TYPES.some((t) => t.key === reportType);
  if (!validType) return res.status(400).json({ error: 'Type de rapport non reconnu' });
  const emails = String(recipientEmails).split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) return res.status(400).json({ error: 'Au moins un email destinataire requis' });
  const nextRunAt = getNextRunAt(frequency, frequencyParam);
  try {
    const r = db.prepare(`
      INSERT INTO scheduled_reports (report_type, frequency, frequency_param, recipient_emails, params_json, next_run_at, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(reportType, frequency, frequencyParam || null, emails.join(', '), paramsJson || null, nextRunAt, req.user.id);
    const row = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table scheduled_reports absente. Exécutez les migrations.' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly']),
  body('recipientEmails').optional().trim(),
  body('isActive').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Rapport planifié non trouvé' });
  const { frequency, frequencyParam, recipientEmails, paramsJson, isActive } = req.body;
  const updates = [];
  const values = [];
  if (frequency !== undefined) {
    updates.push('frequency = ?');
    values.push(frequency);
    updates.push('frequency_param = ?');
    values.push(frequencyParam !== undefined ? frequencyParam : existing.frequency_param);
    updates.push('next_run_at = ?');
    values.push(getNextRunAt(frequency, frequencyParam || existing.frequency_param));
  }
  if (recipientEmails !== undefined) {
    const emails = String(recipientEmails).split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return res.status(400).json({ error: 'Au moins un email destinataire requis' });
    updates.push('recipient_emails = ?');
    values.push(emails.join(', '));
  }
  if (paramsJson !== undefined) { updates.push('params_json = ?'); values.push(paramsJson); }
  if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
  if (updates.length === 0) return res.json(existing);
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  db.prepare(`UPDATE scheduled_reports SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id));
});

router.delete('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM scheduled_reports WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Rapport planifié non trouvé' });
  res.status(204).send();
});

/**
 * Exécute les rapports planifiés dus pour une base client.
 * @param {object} clientDb - base client (req.db ou getClientDb(tenantId))
 * @param {number} [tenantId] - id tenant (optionnel, pour logs)
 */
async function runScheduledReports(clientDb, tenantId) {
  if (!clientDb) return;
  const now = new Date().toISOString().slice(0, 19);
  let rows = [];
  try {
    rows = clientDb.prepare(`
      SELECT id, report_type, frequency, frequency_param, recipient_emails, params_json
      FROM scheduled_reports
      WHERE is_active = 1 AND next_run_at <= ?
    `).all(now);
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('[scheduledReports]', tenantId != null ? `tenant ${tenantId}` : '', e.message);
    return;
  }
  for (const row of rows) {
        try {
          const params = row.params_json ? JSON.parse(row.params_json) : {};
          const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const endDate = params.endDate || new Date().toISOString().slice(0, 10);
          let text = '';
          if (row.report_type === 'maintenance-costs') {
            const data = clientDb.prepare(`
              SELECT e.code, e.name, COUNT(DISTINCT wo.id) as interventions,
                SUM(COALESCE(i.quantity_used * sp.unit_price, 0)) as parts_cost,
                SUM(COALESCE(i.hours_spent * 45, 0)) as labor_cost
              FROM work_orders wo
              JOIN equipment e ON wo.equipment_id = e.id
              LEFT JOIN interventions i ON i.work_order_id = wo.id
              LEFT JOIN spare_parts sp ON i.spare_part_id = sp.id
              WHERE wo.status = 'completed' AND date(wo.actual_end) BETWEEN ? AND ?
              GROUP BY e.id
            `).all(startDate, endDate);
            text = `Rapport Coûts de maintenance (${startDate} - ${endDate})\n\n${JSON.stringify(data, null, 2)}`;
          } else if (row.report_type === 'work-orders') {
            const data = clientDb.prepare(`
              SELECT wo.number, wo.title, wo.status, wo.actual_end, e.name as equipment_name
              FROM work_orders wo
              LEFT JOIN equipment e ON wo.equipment_id = e.id
              WHERE date(wo.created_at) BETWEEN ? AND ?
              ORDER BY wo.created_at DESC LIMIT 200
            `).all(startDate, endDate);
            text = `Rapport OT (${startDate} - ${endDate})\n\n${JSON.stringify(data, null, 2)}`;
          } else if (row.report_type === 'kpis') {
            const woTotal = clientDb.prepare('SELECT COUNT(*) as c FROM work_orders WHERE date(created_at) BETWEEN ? AND ?').get(startDate, endDate);
            const woCompleted = clientDb.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status = 'completed' AND date(actual_end) BETWEEN ? AND ?").get(startDate, endDate);
            text = `Indicateurs KPI (${startDate} - ${endDate})\nOT créés: ${woTotal?.c ?? 0}\nOT terminés: ${woCompleted?.c ?? 0}`;
          } else {
            text = `Rapport ${row.report_type} (${startDate} - ${endDate})\nGénéré le ${new Date().toLocaleString('fr-FR')}.`;
          }
          const recipients = String(row.recipient_emails).split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
          await notificationService.sendEmail(
            recipients,
            `[GMAO] Rapport planifié - ${row.report_type}`,
            text,
            `<pre>${text.replace(/</g, '&lt;')}</pre>`
          );
          const nextRun = getNextRunAt(row.frequency, row.frequency_param);
          clientDb.prepare('UPDATE scheduled_reports SET last_run_at = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(now, nextRun, row.id);
          if (clientDb._save) clientDb._save();
        } catch (err) {
          console.warn('[scheduledReports] run report', row.id, err.message);
        }
  }
}

module.exports = router;
module.exports.runScheduledReports = runScheduledReports;
