/**
 * API Pointage (time entries) - entrées/sorties manuelles ou pointeuse
 * Données en base client (req.db). technician_id = user id dans gmao.db.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '../../uploads/time-entries');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `import-${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_')}`)
  }),
  limits: { fileSize: 2 * 1024 * 1024 }
});

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

// Liste des pointages (filtres : technicianId, dateFrom, dateTo)
router.get('/', requirePermission('time_entries', 'view'), [
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

  let countSql = 'SELECT COUNT(*) as total FROM time_entries WHERE technician_id IN (' + allowedIds.map(() => '?').join(',') + ')';
  let listSql = 'SELECT id, technician_id, occurred_at, type, source, created_at, created_by FROM time_entries WHERE technician_id IN (' + allowedIds.map(() => '?').join(',') + ')';
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
    countSql += ' AND occurred_at >= ?';
    listSql += ' AND occurred_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    countSql += ' AND occurred_at <= ?';
    listSql += ' AND occurred_at <= ?';
    params.push(dateTo + 'T23:59:59.999');
  }

  const countParams = [...params];
  listSql += ' ORDER BY occurred_at DESC LIMIT ? OFFSET ?';
  const listParams = [...params, limit, offset];

  const total = db.prepare(countSql).get(...countParams)?.total ?? 0;
  let rows = [];
  try {
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

// Créer un pointage (manuel)
router.post('/', requirePermission('time_entries', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), [
  body('technicianId').isInt().toInt(),
  body('occurredAt').notEmpty().trim(),
  body('type').isIn(['in', 'out']),
  body('source').optional().isIn(['manual', 'pointeuse'])
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  const technicianId = req.body.technicianId;
  if (!allowedIds.includes(technicianId)) {
    return res.status(403).json({ error: 'Technicien non autorisé.' });
  }

  const occurredAt = req.body.occurredAt.trim();
  const type = req.body.type;
  const source = req.body.source || 'manual';

  const db = req.db;
  let id;
  try {
    const r = db.prepare(`
      INSERT INTO time_entries (technician_id, occurred_at, type, source, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(technicianId, occurredAt, type, source, req.user.id);
    id = r.lastInsertRowid;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.status(503).json({ error: 'Table pointage non disponible.' });
    }
    throw e;
  }

  const row = db.prepare('SELECT id, technician_id, occurred_at, type, source, created_at, created_by FROM time_entries WHERE id = ?').get(id);
  const items = enrichWithTechnicianNames(adminDb, [row]);
  res.status(201).json(items[0]);
});

// Supprimer un pointage (correction)
router.delete('/:id', requirePermission('time_entries', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt().toInt()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id, technician_id FROM time_entries WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Pointage introuvable.' });
  }

  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  if (!allowedIds.includes(existing.technician_id)) {
    return res.status(403).json({ error: 'Technicien non autorisé.' });
  }

  db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  res.status(204).end();
});

/** Résout technician_id à partir de badge_code (table technician_badges) ou de l'ID si numérique */
function resolveTechnicianId(db, adminDb, tenantId, badgeOrId) {
  if (badgeOrId == null || badgeOrId === '') return null;
  const num = parseInt(badgeOrId, 10);
  if (!isNaN(num)) {
    const allowed = getTechnicianIdsForTenant(adminDb, tenantId);
    return allowed.includes(num) ? num : null;
  }
  try {
    const row = db.prepare('SELECT technician_id FROM technician_badges WHERE badge_code = ?').get(String(badgeOrId).trim());
    return row ? row.technician_id : null;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return null;
    throw e;
  }
}

/**
 * POST /api/time-entries/import — Import pointages (CSV ou JSON)
 * CSV: header technician_id,badge_code,occurred_at,type ou date,heure,type,badge_code
 * JSON: [{ technicianId?, badgeCode?, occurredAt, type: 'in'|'out' }, ...]
 */
router.post('/import', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), upload.single('file'), (req, res) => {
  const db = req.db;
  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  if (allowedIds.length === 0) {
    return res.status(400).json({ error: 'Aucun technicien pour ce tenant.' });
  }

  let rows = [];
  if (req.file && req.file.path) {
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const header = (lines[0] || '').toLowerCase();
    const hasBadge = header.includes('badge');
    const hasTechId = header.includes('technician');
    const hasDate = header.includes('date') || header.includes('occurred');
    const hasType = header.includes('type');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t]/).map((p) => p.trim());
      if (parts.length < 2) continue;
      let technicianId = null;
      let badgeCode = null;
      let occurredAt = null;
      let type = 'in';
      if (hasTechId && hasBadge) {
        technicianId = parseInt(parts[0], 10);
        badgeCode = parts[1];
        occurredAt = parts[2] || null;
        type = (parts[3] || 'in').toLowerCase().startsWith('out') ? 'out' : 'in';
      } else if (hasBadge) {
        badgeCode = parts[hasDate ? 2 : 0];
        const datePart = parts[0] || '';
        const timePart = parts[1] || '08:00';
        occurredAt = `${datePart}T${timePart}:00`.replace(/\//g, '-');
        type = (parts[hasDate ? 3 : 2] || 'in').toLowerCase().startsWith('out') ? 'out' : 'in';
      } else {
        technicianId = parseInt(parts[0], 10);
        occurredAt = parts[1] || null;
        type = (parts[2] || 'in').toLowerCase().startsWith('out') ? 'out' : 'in';
      }
      const tid = technicianId != null && allowedIds.includes(technicianId) ? technicianId : resolveTechnicianId(db, adminDb, req.tenantId, badgeCode || technicianId);
      if (tid == null || !occurredAt) continue;
      rows.push({ technicianId: tid, occurredAt, type });
    }
    try { fs.unlinkSync(req.file.path); } catch (_) {}
  } else if (Array.isArray(req.body)) {
    for (const r of req.body) {
      const tid = r.technicianId != null && allowedIds.includes(parseInt(r.technicianId, 10)) ? parseInt(r.technicianId, 10) : resolveTechnicianId(db, adminDb, req.tenantId, r.badgeCode || r.badge_code);
      if (tid == null || !r.occurredAt) continue;
      rows.push({ technicianId: tid, occurredAt: r.occurredAt, type: (r.type || 'in').toLowerCase().startsWith('out') ? 'out' : 'in' });
    }
  } else if (req.body.entries && Array.isArray(req.body.entries)) {
    for (const r of req.body.entries) {
      const tid = r.technicianId != null && allowedIds.includes(parseInt(r.technicianId, 10)) ? parseInt(r.technicianId, 10) : resolveTechnicianId(db, adminDb, req.tenantId, r.badgeCode || r.badge_code);
      if (tid == null || !r.occurredAt) continue;
      rows.push({ technicianId: tid, occurredAt: r.occurredAt, type: (r.type || 'in').toLowerCase().startsWith('out') ? 'out' : 'in' });
    }
  } else {
    return res.status(400).json({ error: 'Envoi requis : fichier CSV ou body JSON { entries: [{ badgeCode|technicianId, occurredAt, type }] }' });
  }

  const created = [];
  const createdBy = req.user.id;
  try {
    const stmt = db.prepare(`
      INSERT INTO time_entries (technician_id, occurred_at, type, source, created_by) VALUES (?, ?, ?, 'pointeuse', ?)
    `);
    for (const r of rows) {
      stmt.run(r.technicianId, r.occurredAt.replace(' ', 'T'), r.type, createdBy);
      created.push({ technicianId: r.technicianId, occurredAt: r.occurredAt, type: r.type });
    }
    if (db._save) db._save();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.status(503).json({ error: 'Table pointage non disponible.' });
    }
    throw e;
  }
  res.status(201).json({ imported: created.length, entries: created });
});

/** GET/POST/DELETE technician badges (mapping badge_code → technicien) */
router.get('/badges', (req, res) => {
  const db = req.db;
  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  try {
    const rows = db.prepare(`
      SELECT tb.id, tb.technician_id, tb.badge_code, tb.created_at
      FROM technician_badges tb
      WHERE tb.technician_id IN (${allowedIds.map(() => '?').join(',')})
      ORDER BY tb.badge_code
    `).all(...allowedIds);
    const ids = [...new Set(rows.map((r) => r.technician_id))];
    const names = adminDb.prepare(`SELECT id, first_name, last_name FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const byId = Object.fromEntries(names.map((n) => [n.id, `${n.first_name || ''} ${n.last_name || ''}`.trim()]));
    res.json(rows.map((r) => ({ id: r.id, technicianId: r.technician_id, technicianName: byId[r.technician_id] || '', badgeCode: r.badge_code, createdAt: r.created_at })));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/badges', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('technicianId').isInt().toInt(),
  body('badgeCode').notEmpty().trim()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const db = req.db;
  const adminDb = dbModule.getAdminDb();
  const allowedIds = getTechnicianIdsForTenant(adminDb, req.tenantId);
  const technicianId = parseInt(req.body.technicianId, 10);
  const badgeCode = String(req.body.badgeCode).trim();
  if (!allowedIds.includes(technicianId)) return res.status(403).json({ error: 'Technicien non autorisé.' });
  try {
    const existing = db.prepare('SELECT id, technician_id FROM technician_badges WHERE badge_code = ?').get(badgeCode);
    if (existing) {
      db.prepare('UPDATE technician_badges SET technician_id = ? WHERE badge_code = ?').run(technicianId, badgeCode);
    } else {
      db.prepare('INSERT INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(technicianId, badgeCode);
    }
    const row = db.prepare('SELECT id, technician_id, badge_code, created_at FROM technician_badges WHERE badge_code = ?').get(badgeCode);
    res.status(existing ? 200 : 201).json({ id: row.id, technicianId: row.technician_id, badgeCode: row.badge_code, createdAt: row.created_at });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce badge est déjà associé à un autre technicien.' });
    if (e.message && e.message.includes('no such table')) return res.status(503).json({ error: 'Table technician_badges non disponible.' });
    throw e;
  }
});

router.delete('/badges/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM technician_badges WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Association badge non trouvée.' });
  res.status(204).end();
});

module.exports = router;
