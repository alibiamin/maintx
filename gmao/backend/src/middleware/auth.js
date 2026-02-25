/**
 * Middleware d'authentification JWT et gestion des rôles
 * Multi-tenant : attache req.db (admin ou base client) selon tenantId du JWT.
 */

const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { getModuleCodeForPath, filterValidModuleCodes } = require('../config/modules');

const JWT_SECRET = process.env.JWT_SECRET || 'xmaint-jwt-secret-change-in-production';
const DEFAULT_JWT_SECRET = 'xmaint-jwt-secret-change-in-production';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET)) {
  console.error('JWT_SECRET obligatoire en production. Définissez une clé sécurisée (ex: .env) et redémarrez.');
  process.exit(1);
}

/**
 * Vérifie le token JWT, détermine la base (admin vs client) et attache req.user et req.db
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const mainDb = db.getAdminDb();
    let user;
    try {
      user = mainDb.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, u.tenant_id, u.revoked_at, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ? AND u.is_active = 1
      `).get(decoded.userId);
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        user = mainDb.prepare(`
          SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, r.name as role_name
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.id = ? AND u.is_active = 1
        `).get(decoded.userId);
        if (user) { user.tenant_id = null; user.revoked_at = null; }
      } else throw e;
    }
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }
    if (user.revoked_at && decoded.iat != null) {
      const revokedTs = Math.floor(new Date(user.revoked_at).getTime() / 1000);
      if (decoded.iat < revokedTs) {
        return res.status(401).json({ error: 'Session révoquée. Reconnectez-vous.', code: 'SESSION_REVOKED' });
      }
    }
    req.jwtPayload = decoded;
    const tenantId = user.tenant_id ?? null;
    if (decoded.tenantId !== undefined && decoded.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Token invalide (tenant)' });
    }
    if (tenantId != null) {
      let tenant;
      try {
        tenant = mainDb.prepare('SELECT status, deleted_at, license_start, license_end, enabled_modules FROM tenants WHERE id = ?').get(tenantId);
      } catch (e) {
        if (e.message && e.message.includes('no such column')) {
          tenant = mainDb.prepare('SELECT status, deleted_at, license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
          if (!tenant) tenant = mainDb.prepare('SELECT license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
          if (tenant) {
            if (!tenant.status) tenant.status = 'active';
            if (tenant.deleted_at === undefined) tenant.deleted_at = null;
            tenant.enabled_modules = null;
          }
        } else throw e;
      }
      if (!tenant) {
        return res.status(403).json({ error: 'Client inexistant ou inaccessible.', code: 'TENANT_INVALID' });
      }
      const status = (tenant.status && String(tenant.status).trim()) || 'active';
      if (status === 'deleted' || tenant.deleted_at) {
        return res.status(403).json({ error: 'Ce client a été supprimé. Accès impossible.', code: 'TENANT_DELETED' });
      }
      if (status === 'suspended' || status === 'expired') {
        return res.status(403).json({
          error: status === 'suspended' ? 'Compte client suspendu. Contactez l\'administrateur.' : 'Licence expirée. Contactez l\'administrateur.',
          code: status === 'suspended' ? 'TENANT_SUSPENDED' : 'LICENSE_EXPIRED'
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (tenant.license_end && String(tenant.license_end).trim() && today > tenant.license_end) {
        return res.status(403).json({ error: 'Licence expirée. Contactez l\'administrateur pour une nouvelle activation.', code: 'LICENSE_EXPIRED' });
      }
      if (tenant.license_start && String(tenant.license_start).trim() && today < tenant.license_start) {
        return res.status(403).json({ error: 'Licence pas encore active.', code: 'LICENSE_NOT_ACTIVE' });
      }
      let enabledModules = null;
      if (tenant.enabled_modules != null && String(tenant.enabled_modules).trim()) {
        try {
          const parsed = JSON.parse(tenant.enabled_modules);
          enabledModules = Array.isArray(parsed) ? filterValidModuleCodes(parsed) : null;
        } catch (_) {}
      }
      req.enabledModules = enabledModules;
    } else {
      req.enabledModules = null;
    }
    req.user = user;
    try {
      const perms = mainDb.prepare(`
        SELECT p.code FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
      `).all(user.role_id).map(r => r.code);
      req.user.permissions = perms;
    } catch (e) {
      req.user.permissions = [];
    }
    try {
      req.db = db.getDbForRequest(tenantId);
    } catch (err) {
      if (err.message && (err.message.includes('Tenant inconnu') || err.message.includes('inconnu'))) {
        return res.status(403).json({
          error: 'Client supprimé ou inaccessible. Reconnectez-vous ou contactez l\'administrateur.',
          code: 'TENANT_INVALID'
        });
      }
      throw err;
    }
    req.tenantId = tenantId;
    if (tenantId != null && Array.isArray(req.enabledModules)) {
      const path = (req.originalUrl || req.url || '').split('?')[0];
      const moduleCode = getModuleCodeForPath(path);
      if (moduleCode && !req.enabledModules.includes(moduleCode)) {
        return res.status(403).json({
          error: 'Module non activé pour votre client',
          code: 'MODULE_DISABLED',
          module: moduleCode
        });
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

/**
 * Vérifie que l'utilisateur possède l'un des rôles autorisés
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (allowedRoles.includes(req.user.role_name)) {
      return next();
    }
    return res.status(403).json({ error: 'Accès refusé - permissions insuffisantes' });
  };
}

/**
 * Vérifie que l'utilisateur a la permission (resource, action).
 * req.user.permissions doit être chargé (fait dans authenticate).
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const code = `${resource}.${action}`;
    const permissions = req.user.permissions || [];
    if (permissions.includes(code)) {
      return next();
    }
    return res.status(403).json({ error: 'Accès refusé - permission manquante', required: code });
  };
}

/**
 * Réserve l'accès aux administrateurs MAINTX (plateforme) uniquement.
 * Un admin MAINTX = rôle administrateur ET sans tenant (tenant_id null).
 * Les admins clients (role administrateur mais avec tenant_id) n'ont pas accès.
 */
function requireMaintxAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const isAdminRole = req.user.role_name === 'administrateur';
  const isPlatformAdmin = req.tenantId == null || (req.jwtPayload && req.jwtPayload.isMaintxAdmin === true);
  if (isAdminRole && isPlatformAdmin) {
    return next();
  }
  return res.status(403).json({
    error: 'Réservé aux administrateurs MAINTX (plateforme). La gestion des clients (tenants) n\'est pas accessible aux administrateurs d\'un client.'
  });
}

const ROLES = {
  ADMIN: 'administrateur',
  RESPONSABLE: 'responsable_maintenance',
  PLANIFICATEUR: 'planificateur',
  TECHNICIEN: 'technicien',
  UTILISATEUR: 'utilisateur'
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  requireMaintxAdmin,
  JWT_SECRET,
  ROLES
};
