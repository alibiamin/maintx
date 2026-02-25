/**
 * API Tenants (admin MAINTX) — paramétrage des clients
 * Un client = un enregistrement dans gmao.tenants. La base .db est créée à la création du tenant (migrations appliquées, pas à la 1re connexion).
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const { authenticate, requireMaintxAdmin } = require('../middleware/auth');
const dbModule = require('../database/db');
const auditLog = require('../services/auditLog');
const path = require('path');
const fs = require('fs');
const { getAllModuleCodes, MODULE_LABELS, getModulePacks, filterValidModuleCodes } = require('../config/modules');

const router = express.Router();
router.use(authenticate);
// Réservé aux admins MAINTX (plateforme) : tenant_id null. Les admins clients n'ont pas accès.
router.use(requireMaintxAdmin);

const ALLOWED_STATUSES = ['trial', 'active', 'suspended', 'expired', 'deleted'];

/**
 * GET /api/tenants/modules
 * Liste des codes et libellés des modules (pour l’admin qui édite les modules activés par tenant).
 */
router.get('/modules', (req, res) => {
  res.json({ codes: getAllModuleCodes(), labels: MODULE_LABELS, packs: getModulePacks() });
});

function parseEnabledModules(val) {
  if (val == null || typeof val !== 'string' || !val.trim()) return null;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) { return null; }
}

function mapTenantRow(r) {
  const today = new Date().toISOString().slice(0, 10);
  const start = r.license_start && String(r.license_start).trim();
  const end = r.license_end && String(r.license_end).trim();
  const status = (r.status && String(r.status).trim()) || 'active';
  let isActive = status === 'active' || status === 'trial';
  if (isActive && end && today > end) isActive = false;
  else if (isActive && start && today < start) isActive = false;
  return {
    id: r.id,
    name: r.name,
    dbFilename: r.db_filename,
    emailDomain: r.email_domain,
    status,
    licenseStart: r.license_start || null,
    licenseEnd: r.license_end || null,
    isActive,
    deletedAt: r.deleted_at || null,
    createdAt: r.created_at,
    enabledModules: parseEnabledModules(r.enabled_modules) ?? undefined
  };
}

/**
 * GET /api/tenants
 * Liste des tenants (base admin uniquement). Par défaut exclut les tenants supprimés (soft delete).
 * ?includeDeleted=1 pour inclure les tenants avec status=deleted.
 */
router.get('/', (req, res) => {
  try {
    const adminDb = dbModule.getAdminDb();
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    let rows;
    try {
      rows = adminDb.prepare(`
        SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at, enabled_modules
        FROM tenants
        WHERE (? = 1 OR (COALESCE(status, 'active') != 'deleted' AND deleted_at IS NULL))
        ORDER BY name
      `).all(includeDeleted ? 1 : 0);
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        try {
          rows = adminDb.prepare(`
            SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at
            FROM tenants
            WHERE (? = 1 OR (COALESCE(status, 'active') != 'deleted' AND deleted_at IS NULL))
            ORDER BY name
          `).all(includeDeleted ? 1 : 0);
        } catch (e2) {
          rows = adminDb.prepare(`
            SELECT id, name, db_filename, email_domain, license_start, license_end, created_at
            FROM tenants ORDER BY name
          `).all();
          rows.forEach(r => { r.status = 'active'; r.deleted_at = null; });
        }
        rows.forEach(r => { if (r.enabled_modules === undefined) r.enabled_modules = null; });
      } else throw e;
    }
    res.json(rows.map(mapTenantRow));
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('tenants'))) {
      return res.status(500).json({
        error: 'Table des clients (tenants) absente. Vérifiez que les migrations ont été exécutées au démarrage du serveur.'
      });
    }
    throw e;
  }
});

/**
 * GET /api/tenants/:id/export
 * Export des données du tenant (RGPD / portabilité). Réservé MAINTX.
 * Retourne : infos tenant, utilisateurs (sans mot de passe), données métier principales (sites, équipements, OT…).
 */
router.get('/:id/export', [param('id').isInt({ min: 1 })], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  const adminDb = dbModule.getAdminDb();
  let row = adminDb.prepare('SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?').get(id);
  try {
    row = adminDb.prepare('SELECT id, name, db_filename, email_domain, status, license_start, license_end, created_at, deleted_at FROM tenants WHERE id = ?').get(id) || row;
  } catch (_) {}
  if (!row) return res.status(404).json({ error: 'Tenant non trouvé' });
  const exportData = {
    exportedAt: new Date().toISOString(),
    tenant: {
      id: row.id,
      name: row.name,
      emailDomain: row.email_domain,
      status: row.status || 'active',
      licenseStart: row.license_start,
      licenseEnd: row.license_end,
      createdAt: row.created_at
    },
    users: [],
    sites: [],
    equipment: [],
    workOrders: []
  };
  try {
    const users = adminDb.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.tenant_id = ?
    `).all(id);
    exportData.users = users;
  } catch (_) {}
  try {
    const clientDb = dbModule.getClientDb(id);
    try {
      exportData.sites = clientDb.prepare('SELECT id, name, code, address FROM sites').all();
    } catch (_) {}
    try {
      exportData.equipment = clientDb.prepare('SELECT id, code, name, site_id FROM equipment LIMIT 10000').all();
    } catch (_) {}
    try {
      exportData.workOrders = clientDb.prepare('SELECT id, number, title, status, priority, created_at FROM work_orders ORDER BY id DESC LIMIT 5000').all();
    } catch (_) {}
  } catch (_) {}
  try {
    auditLog.log({
      userId: req.user.id,
      tenantId: null,
      action: 'tenant_export',
      resource: 'tenants',
      details: { tenantId: id, name: row.name },
      ip: auditLog.getClientIp(req)
    });
  } catch (_) {}
  res.setHeader('Content-Disposition', `attachment; filename="tenant-${id}-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(exportData);
});

/**
 * POST /api/tenants
 * Créer un tenant et l'utilisateur admin de ce client.
 * Body: { name, emailDomain, dbFilename?, initSchema?, licenseStart?, licenseEnd?, adminEmail, adminPassword, adminFirstName, adminLastName }
 */
router.post('/', [
  body('name').notEmpty().trim(),
  body('emailDomain').notEmpty().trim(),
  body('dbFilename').optional().trim(),
  body('licenseStart').optional().trim(),
  body('licenseEnd').optional().trim(),
  body('adminEmail').isEmail().normalizeEmail(),
  body('adminPassword').isLength({ min: 8 }),
  body('adminFirstName').notEmpty().trim(),
  body('adminLastName').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, emailDomain, licenseStart, licenseEnd, adminEmail, adminPassword, adminFirstName, adminLastName } = req.body;
  const domain = String(emailDomain).trim().toLowerCase().replace(/^@/, '');
  const emailDomainFromAdmin = adminEmail.split('@')[1]?.toLowerCase();
  if (emailDomainFromAdmin !== domain) {
    return res.status(400).json({ error: `L'email de l'admin doit appartenir au domaine du client (ex: admin@${domain})` });
  }

  const dbFilename = req.body.dbFilename && String(req.body.dbFilename).trim()
    ? (req.body.dbFilename.endsWith('.db') ? req.body.dbFilename : `${req.body.dbFilename}.db`)
    : `client_${domain.replace(/[^a-z0-9]/g, '_')}.db`;

  const adminDb = dbModule.getAdminDb();
  const existing = adminDb.prepare('SELECT id FROM tenants WHERE LOWER(TRIM(email_domain)) = ?').get(domain);
  if (existing) return res.status(409).json({ error: 'Un tenant avec ce domaine email existe déjà' });
  const existingFile = adminDb.prepare('SELECT id FROM tenants WHERE db_filename = ?').get(dbFilename);
  if (existingFile) return res.status(409).json({ error: 'Ce nom de fichier base est déjà utilisé' });
  const existingUser = adminDb.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (existingUser) return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre compte' });

  const ls = normalizeDate(licenseStart);
  const le = normalizeDate(licenseEnd);
  let insertResult;
  try {
    insertResult = adminDb.prepare(
      'INSERT INTO tenants (name, db_filename, email_domain, license_start, license_end, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, dbFilename, domain, ls || null, le || null, 'trial');
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      insertResult = adminDb.prepare(
        'INSERT INTO tenants (name, db_filename, email_domain, license_start, license_end) VALUES (?, ?, ?, ?, ?)'
      ).run(name, dbFilename, domain, ls || null, le || null);
    } else throw e;
  }
  adminDb._save();
  const tenantId = insertResult.lastInsertRowid;
  let row = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(tenantId);
  try {
    row = adminDb.prepare(`
      SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at FROM tenants WHERE id = ?
    `).get(tenantId);
  } catch (_) {}
  if (!row.status) row.status = 'trial'; if (row.deleted_at === undefined) row.deleted_at = null;

  const adminRole = adminDb.prepare("SELECT id FROM roles WHERE name = 'administrateur'").get();
  if (!adminRole) {
    adminDb.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
    adminDb._save();
    return res.status(500).json({ error: 'Rôle administrateur introuvable dans la base' });
  }
  const hash = bcrypt.hashSync(adminPassword, 10);
  try {
    adminDb.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id, tenant_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(adminEmail, hash, adminFirstName, adminLastName, adminRole.id, tenantId);
    adminDb._save();
  } catch (e) {
    adminDb.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
    adminDb._save();
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    throw e;
  }

  // Création immédiate de la base client (migrations appliquées) — évite crash à la 1re connexion
  const createResult = dbModule.createTenantDatabase && dbModule.createTenantDatabase(row.id);
  if (createResult && !createResult.ok) {
    adminDb.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
    adminDb.prepare('DELETE FROM users WHERE tenant_id = ?').run(tenantId);
    adminDb._save();
    return res.status(500).json({
      error: 'Impossible de créer la base client. Vérifiez les permissions disque.',
      details: process.env.NODE_ENV === 'development' ? createResult.error : undefined
    });
  }

  try {
    auditLog.log({
      userId: req.user.id,
      tenantId: null,
      action: 'tenant_created',
      resource: 'tenants',
      details: { tenantId, name: row.name, dbFilename: row.db_filename },
      ip: auditLog.getClientIp(req)
    });
  } catch (_) {}

  res.status(201).json(mapTenantRow(row));
});

function normalizeDate(v) {
  if (v == null || typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * PUT /api/tenants/:id
 * Mettre à jour un tenant (nom, période de licence, status). email_domain et db_filename non modifiables.
 * Body: { name?, licenseStart?, licenseEnd?, status? } — status: trial | active | suspended | expired (pas 'deleted', utiliser DELETE pour soft delete).
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim(),
  body('licenseStart').optional().trim(),
  body('licenseEnd').optional().trim(),
  body('status').optional({ values: 'falsy' }).trim().isIn(ALLOWED_STATUSES.filter(s => s !== 'deleted')),
  body('enabledModules').optional().isArray()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identifiant client invalide' });
  const { name, licenseStart, licenseEnd, status, enabledModules } = req.body;
  const adminDb = dbModule.getAdminDb();
  let row = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(id);
  try {
    row = adminDb.prepare(`
      SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at FROM tenants WHERE id = ?
    `).get(id);
  } catch (_) {}
  if (!row) return res.status(404).json({ error: 'Tenant non trouvé' });
  if (row.status === 'deleted' || row.deleted_at) {
    return res.status(410).json({ error: 'Impossible de modifier un client supprimé.', code: 'TENANT_DELETED' });
  }
  const newName = name !== undefined && String(name).trim() ? String(name).trim() : row.name;
  const newStart = normalizeDate(licenseStart);
  const newEnd = normalizeDate(licenseEnd);
  const newStatus = (status && ALLOWED_STATUSES.includes(status) && status !== 'deleted') ? status : (row.status || 'active');
  const enabledModulesPayload = enabledModules === undefined
    ? undefined
    : (Array.isArray(enabledModules) ? JSON.stringify(filterValidModuleCodes(enabledModules)) : null);
  try {
    if (enabledModulesPayload !== undefined) {
      adminDb.prepare('UPDATE tenants SET name = ?, license_start = ?, license_end = ?, status = ?, enabled_modules = ? WHERE id = ?')
        .run(newName, newStart || null, newEnd || null, newStatus, enabledModulesPayload, id);
    } else {
      adminDb.prepare('UPDATE tenants SET name = ?, license_start = ?, license_end = ?, status = ? WHERE id = ?')
        .run(newName, newStart || null, newEnd || null, newStatus, id);
    }
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      adminDb.prepare('UPDATE tenants SET name = ?, license_start = ?, license_end = ?, status = ? WHERE id = ?')
        .run(newName, newStart || null, newEnd || null, newStatus, id);
    } else throw e;
  }
  adminDb._save();
  try {
    auditLog.log({
      userId: req.user.id,
      tenantId: null,
      action: 'tenant_updated',
      resource: 'tenants',
      details: { tenantId: id, name: newName, licenseStart: newStart, licenseEnd: newEnd, status: newStatus, enabledModules: enabledModulesPayload !== undefined },
      ip: auditLog.getClientIp(req)
    });
  } catch (_) {}
  let updated = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(id);
  try {
    updated = adminDb.prepare(`
      SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at, enabled_modules FROM tenants WHERE id = ?
    `).get(id);
  } catch (_) {
    try {
      updated = adminDb.prepare(`
        SELECT id, name, db_filename, email_domain, status, deleted_at, license_start, license_end, created_at FROM tenants WHERE id = ?
      `).get(id);
    } catch (_2) {}
  }
  if (!updated.status) updated.status = newStatus; if (updated.deleted_at === undefined) updated.deleted_at = null; if (updated.enabled_modules === undefined) updated.enabled_modules = null;
  res.json(mapTenantRow(updated));
});

/**
 * DELETE /api/tenants/:id
 * Soft delete : marque le tenant comme supprimé (status=deleted, deleted_at), désactive la licence, révoque les sessions.
 * La base .db n'est pas supprimée immédiatement (récupération possible). Suppression physique à faire par un job après délai (ex. 30 j).
 * Refusé s'il reste des utilisateurs associés à ce client.
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const adminDb = dbModule.getAdminDb();
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identifiant client invalide' });
  const row = adminDb.prepare('SELECT id, name, db_filename FROM tenants WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Tenant non trouvé' });
  try {
    const t = adminDb.prepare('SELECT status, deleted_at FROM tenants WHERE id = ?').get(id);
    if (t && (t.status === 'deleted' || t.deleted_at)) {
      return res.status(410).json({ error: 'Ce client est déjà supprimé (soft delete).', code: 'TENANT_ALREADY_DELETED' });
    }
  } catch (_) {}
  let userCount = 0;
  try {
    userCount = adminDb.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ?').get(id).c;
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }
  if (userCount > 0) {
    return res.status(409).json({
      error: `Impossible de supprimer ce client : ${userCount} utilisateur(s) encore associé(s). Désactivez-les ou réaffectez-les depuis la gestion des utilisateurs, puis réessayez.`
    });
  }

  // 1) Invalider tous les refresh tokens des utilisateurs de ce tenant
  try {
    const userIds = adminDb.prepare('SELECT id FROM users WHERE tenant_id = ?').all(id).map(u => u.id);
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      adminDb.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id IN (${placeholders})`).run(...userIds);
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) {
      return res.status(500).json({ error: 'Erreur lors de la révocation des sessions.' });
    }
  }

  // 2) Audit log
  try {
    auditLog.log({
      userId: req.user.id,
      tenantId: id,
      action: 'tenant_deleted',
      resource: 'tenants',
      details: { tenantId: id, name: row.name, dbFilename: row.db_filename, softDelete: true },
      ip: auditLog.getClientIp(req)
    });
  } catch (_) {}

  // 3) Fermer la base client en cache (plus d'accès). Ne pas supprimer le fichier .db tout de suite.
  if (row.db_filename && row.db_filename !== 'default.db' && dbModule.removeClientDbFromCache) {
    dbModule.removeClientDbFromCache(row.db_filename);
  }

  // 4) Soft delete : status=deleted, deleted_at=now, licence désactivée (license_end=aujourd'hui)
  const today = new Date().toISOString().slice(0, 10);
  try {
    adminDb.prepare(`
      UPDATE tenants SET status = 'deleted', deleted_at = datetime('now'), license_end = ?
      WHERE id = ?
    `).run(today, id);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      adminDb.prepare('UPDATE tenants SET license_end = ? WHERE id = ?').run(today, id);
    } else throw e;
  }
  adminDb._save();
  res.status(204).send();
});

module.exports = router;
