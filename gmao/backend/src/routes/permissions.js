/**
 * API Permissions et rôles
 * GET /api/permissions — liste des permissions (ressource + action)
 * GET /api/roles — liste des rôles
 * GET /api/roles/:id/permissions — permissions d'un rôle
 * PUT /api/roles/:id/permissions — affecter les permissions à un rôle (admin)
 */

const express = require('express');
const { param, body, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, requirePermission, requireMaintxAdmin, ROLES } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/** GET /api/permissions — liste toutes les permissions (groupées par ressource) */
router.get('/', requirePermission('settings', 'view'), (req, res) => {
  const adminDb = db.getAdminDb();
  try {
    const rows = adminDb.prepare(`
      SELECT id, code, resource, action, name_fr, name_en
      FROM permissions
      ORDER BY resource, action
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la lecture des permissions' });
  }
});

/** GET /api/roles — liste des rôles avec nombre d'utilisateurs */
router.get('/roles', requirePermission('settings', 'view'), (req, res) => {
  const adminDb = db.getAdminDb();
  try {
    let rows;
    try {
      rows = adminDb.prepare(`
        SELECT r.id, r.name, r.description, r.created_at,
               (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.is_active = 1) as userCount
        FROM roles r
        ORDER BY r.name
      `).all();
    } catch (e) {
      if (e.message && (e.message.includes('no such column') || e.message.includes('no such table')))
        rows = adminDb.prepare('SELECT id, name, description, created_at FROM roles ORDER BY name').all();
      else throw e;
    }
    res.json(rows.map(r => ({ ...r, userCount: r.userCount != null ? r.userCount : 0 })));
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la lecture des rôles' });
  }
});

/** POST /api/roles — créer un nouveau rôle (réservé plateforme MAINTX) */
router.post('/roles', requireMaintxAdmin, requirePermission('settings', 'update'), authorize(ROLES.ADMIN), [
  body('name').notEmpty().trim().toLowerCase(),
  body('description').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const adminDb = db.getAdminDb();
  const { name, description } = req.body;
  try {
    const existing = adminDb.prepare('SELECT id FROM roles WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Un rôle avec ce nom existe déjà' });
    const r = adminDb.prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name.trim().toLowerCase(), (description || '').trim() || null);
    const row = adminDb.prepare('SELECT id, name, description, created_at FROM roles WHERE id = ?').get(r.lastInsertRowid);
    if (adminDb._save) adminDb._save();
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Un rôle avec ce nom existe déjà' });
    res.status(500).json({ error: 'Erreur lors de la création du rôle' });
  }
});

/** GET /api/roles/:id/permissions — permissions d'un rôle (codes) */
router.get('/roles/:id/permissions', requirePermission('settings', 'view'), param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const adminDb = db.getAdminDb();
  try {
    const codes = adminDb.prepare(`
      SELECT p.code FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `).all(parseInt(req.params.id, 10)).map(r => r.code);
    res.json(codes);
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la lecture des permissions du rôle' });
  }
});

/** PUT /api/roles/:id/permissions — affecter les permissions à un rôle (réservé plateforme MAINTX) */
router.put('/roles/:id/permissions', requireMaintxAdmin, requirePermission('settings', 'update'), authorize(ROLES.ADMIN), [
  param('id').isInt(),
  body('permissions').isArray(),
  body('permissions.*').isString().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const roleId = parseInt(req.params.id, 10);
  const codes = req.body.permissions || [];
  const adminDb = db.getAdminDb();
  try {
    const role = adminDb.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
    if (!role) return res.status(404).json({ error: 'Rôle non trouvé' });
    const validCodes = adminDb.prepare('SELECT id, code FROM permissions WHERE code = ?');
    const permissionIds = [];
    for (const code of codes) {
      const row = validCodes.get(code);
      if (row) permissionIds.push(row.id);
    }
    adminDb.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const insert = adminDb.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permissionIds) {
      insert.run(roleId, pid);
    }
    if (adminDb._save) adminDb._save();
    res.json({ roleId, count: permissionIds.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions du rôle' });
  }
});

module.exports = router;
