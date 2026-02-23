/**
 * API Tenants (admin MAINTX) — paramétrage des clients
 * Un client = un enregistrement dans gmao.tenants. Sa base .db est créée vierge à sa première connexion.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

function mapTenantRow(r) {
  const today = new Date().toISOString().slice(0, 10);
  const start = r.license_start && String(r.license_start).trim();
  const end = r.license_end && String(r.license_end).trim();
  let isActive = true;
  if (end && today > end) isActive = false;
  else if (start && today < start) isActive = false;
  return {
    id: r.id,
    name: r.name,
    dbFilename: r.db_filename,
    emailDomain: r.email_domain,
    licenseStart: r.license_start || null,
    licenseEnd: r.license_end || null,
    isActive,
    createdAt: r.created_at
  };
}

/**
 * GET /api/tenants
 * Liste des tenants (base admin uniquement)
 */
router.get('/', (req, res) => {
  try {
    const adminDb = dbModule.getAdminDb();
    const rows = adminDb.prepare(`
      SELECT id, name, db_filename, email_domain, license_start, license_end, created_at
      FROM tenants ORDER BY name
    `).all();
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
 * POST /api/tenants
 * Créer un tenant et l'utilisateur admin de ce client.
 * Body: { name, emailDomain, dbFilename?, initSchema?, licenseStart?, licenseEnd?, adminEmail, adminPassword, adminFirstName, adminLastName }
 */
router.post('/', [
  body('name').notEmpty().trim(),
  body('emailDomain').notEmpty().trim(),
  body('dbFilename').optional().trim(),
  body('initSchema').optional().isBoolean(),
  body('licenseStart').optional().trim(),
  body('licenseEnd').optional().trim(),
  body('adminEmail').isEmail().normalizeEmail(),
  body('adminPassword').isLength({ min: 8 }),
  body('adminFirstName').notEmpty().trim(),
  body('adminLastName').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, emailDomain, initSchema, licenseStart, licenseEnd, adminEmail, adminPassword, adminFirstName, adminLastName } = req.body;
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
  const insertResult = adminDb.prepare(
    'INSERT INTO tenants (name, db_filename, email_domain, license_start, license_end) VALUES (?, ?, ?, ?, ?)'
  ).run(name, dbFilename, domain, ls || null, le || null);
  adminDb._save();
  const tenantId = insertResult.lastInsertRowid;
  const row = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(tenantId);

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

  if (initSchema) {
    try {
      dbModule.getClientDb(row.id);
    } catch (e) {
      console.warn('[tenants] Création base client:', e.message);
    }
  }

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
 * Mettre à jour un tenant (nom, période de licence). email_domain et db_filename non modifiables.
 * Body: { name?, licenseStart?, licenseEnd? }
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim(),
  body('licenseStart').optional().trim(),
  body('licenseEnd').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identifiant client invalide' });
  const { name, licenseStart, licenseEnd } = req.body;
  const adminDb = dbModule.getAdminDb();
  const row = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Tenant non trouvé' });
  const newName = name !== undefined && String(name).trim() ? String(name).trim() : row.name;
  const newStart = normalizeDate(licenseStart);
  const newEnd = normalizeDate(licenseEnd);
  adminDb.prepare('UPDATE tenants SET name = ?, license_start = ?, license_end = ? WHERE id = ?')
    .run(newName, newStart || null, newEnd || null, id);
  adminDb._save();
  const updated = adminDb.prepare(`
    SELECT id, name, db_filename, email_domain, license_start, license_end, created_at FROM tenants WHERE id = ?
  `).get(id);
  res.json(mapTenantRow(updated));
});

/**
 * DELETE /api/tenants/:id
 * Supprimer un tenant (enregistrement uniquement ; le fichier .db n'est pas supprimé).
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
  const row = adminDb.prepare('SELECT id, db_filename FROM tenants WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Tenant non trouvé' });
  let userCount;
  try {
    userCount = adminDb.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ?').get(id).c;
  } catch (e) {
    if (e.message && e.message.includes('no such column')) userCount = 0;
    else throw e;
  }
  if (userCount > 0) {
    return res.status(409).json({
      error: `Impossible de supprimer ce client : ${userCount} utilisateur(s) encore associé(s). Désactivez-les ou réaffectez-les depuis la gestion des utilisateurs, puis réessayez.`
    });
  }
  adminDb.prepare('DELETE FROM tenants WHERE id = ?').run(id);
  adminDb._save();
  res.status(204).send();
});

module.exports = router;
