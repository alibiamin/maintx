/**
 * API Saisie de présence (congés, formation, maladie, etc.)
 * Données en base client. technician_id = user id dans gmao.db.
 */
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

const OVERRIDE_STATUSES = ['leave', 'training', 'sick', 'other'];

function getTechnicianIdsForTenant(adminDb, tenantId) {
  if (tenantId != null) {
    return adminDb.prepare(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('technicien', 'responsable_maintenance')
    `).all(tenantId).map((r) => r.id);
  }
  // Démo (tenantId null) : techniciens sans client
  return adminDb.prepare(`
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND (u.tenant_id IS NULL OR u.tenant_id = 0) AND r.name IN ('technicien', 'responsable_maintenance')
  `).all().map((r) => r.id);
}

function enrichWithTechnicianNames(adminDb, rows) {
  if (!rows || rows.length === 0) return rows;
  const ids = [...new Set(rows.map((r) => r.technician_id))];
  const placeholders = ids.map(() => '?').join(',');
  const names = adminDb.prepare(
    `SELECT id, first_name, last_name FROM users WHERE id IN (${placeholders})`
  ).all(...ids);
  const byId = Object.fromEntries(names.map((n) => [n.id, { first_name: n.first_name, last_name: n.last_name }]));
  return rows.map((r) => ({
    ...r,
    technician_first_name: byId[r.technician_id]?.first_name ?? null,
    technician_last_name: byId[r.technician_id]?.last_name ?? null
  }));
}

// Liste des saisies (filtres : technicianId, dateFrom, dateTo)
router.get('/', requirePermission('attendance_overrides', 'view'), [
  query('technicianId').optional().isInt().toInt(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const db = req.db;
  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  if (allowedIds.length === 0) {
    return res.json({ items: [], total: 0 });
  }

  const technicianId = req.query.technicianId ? parseInt(req.query.technicianId, 10) : null;
  const dateFrom = req.query.dateFrom || null;
  const dateTo = req.query.dateTo || null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  let countSql = 'SELECT COUNT(*) as total FROM attendance_overrides WHERE technician_id IN (' + allowedIds.map(() => '?').join(',') + ')';
  let listSql = 'SELECT id, technician_id, date, status, comment, created_at, created_by FROM attendance_overrides WHERE technician_id IN (' + allowedIds.map(() => '?').join(',') + ')';
  const params = [...allowedIds];

  if (technicianId != null) {
    if (!allowedIds.includes(technicianId)) {
      return res.status(403).json({ error: 'Technicien non autorisé.' });
    }
    countSql += ' AND technician_id = ?';
    listSql += ' AND technician_id = ?';
    params.push(technicianId);
  }
  if (dateFrom) {
    countSql += ' AND date >= ?';
    listSql += ' AND date >= ?';
    params.push(dateFrom.slice(0, 10));
  }
  if (dateTo) {
    countSql += ' AND date <= ?';
    listSql += ' AND date <= ?';
    params.push(dateTo.slice(0, 10));
  }

  const countParams = [...params];
  listSql += ' ORDER BY date DESC, technician_id LIMIT ? OFFSET ?';
  const listParams = [...params, limit, offset];

  let total = 0;
  let rows = [];
  try {
    total = db.prepare(countSql).get(...countParams)?.total ?? 0;
    rows = db.prepare(listSql).all(...listParams);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.json({ items: [], total: 0 });
    }
    throw e;
  }

  const items = enrichWithTechnicianNames(adminDb, rows);
  res.json({ items, total });
});

// Créer ou remplacer une saisie pour (technicien, date)
router.post('/', requirePermission('attendance_overrides', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('technicianId').isInt().toInt(),
  body('date').notEmpty().trim(),
  body('status').isIn(OVERRIDE_STATUSES),
  body('comment').optional().trim()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  const technicianId = req.body.technicianId;
  if (!allowedIds.includes(technicianId)) {
    return res.status(403).json({ error: 'Technicien non autorisé.' });
  }

  const dateStr = req.body.date.trim().slice(0, 10);
  const status = req.body.status;
  const comment = (req.body.comment || '').trim() || null;

  const db = req.db;
  try {
    const existing = db.prepare('SELECT id FROM attendance_overrides WHERE technician_id = ? AND date = ?').get(technicianId, dateStr);
    if (existing) {
      db.prepare('UPDATE attendance_overrides SET status = ?, comment = ?, created_by = ? WHERE id = ?').run(status, comment, req.user.id, existing.id);
    } else {
      db.prepare(`
        INSERT INTO attendance_overrides (technician_id, date, status, comment, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(technicianId, dateStr, status, comment, req.user.id);
    }
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.status(503).json({ error: 'Table présence non disponible.' });
    }
    throw e;
  }

  const row = db.prepare('SELECT id, technician_id, date, status, comment, created_at, created_by FROM attendance_overrides WHERE technician_id = ? AND date = ?').get(technicianId, dateStr);
  const items = enrichWithTechnicianNames(adminDb, [row]);
  res.status(201).json(items[0]);
});

// Supprimer une saisie
router.delete('/:id', requirePermission('attendance_overrides', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt().toInt()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id, technician_id FROM attendance_overrides WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Saisie introuvable.' });
  }

  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  if (!allowedIds.includes(existing.technician_id)) {
    return res.status(403).json({ error: 'Technicien non autorisé.' });
  }

  db.prepare('DELETE FROM attendance_overrides WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
