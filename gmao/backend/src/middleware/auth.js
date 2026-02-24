/**
 * Middleware d'authentification JWT et gestion des rôles
 * Multi-tenant : attache req.db (admin ou base client) selon tenantId du JWT.
 */

const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'xmaint-jwt-secret-change-in-production';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET === 'xmaint-jwt-secret-change-in-production')) {
  console.warn('⚠️ JWT_SECRET doit être défini en production. Risque de sécurité.');
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
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, u.tenant_id, r.name as role_name
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
        if (user) user.tenant_id = null;
      } else throw e;
    }
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }
    const tenantId = user.tenant_id ?? null;
    if (decoded.tenantId !== undefined && decoded.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Token invalide (tenant)' });
    }
    if (tenantId != null) {
      const tenant = mainDb.prepare('SELECT license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
      if (tenant) {
        const today = new Date().toISOString().slice(0, 10);
        if (tenant.license_end && String(tenant.license_end).trim() && today > tenant.license_end) {
          return res.status(403).json({ error: 'Licence expirée. Contactez l\'administrateur pour une nouvelle activation.', code: 'LICENSE_EXPIRED' });
        }
        if (tenant.license_start && String(tenant.license_start).trim() && today < tenant.license_start) {
          return res.status(403).json({ error: 'Licence pas encore active.', code: 'LICENSE_NOT_ACTIVE' });
        }
      }
    }
    req.user = user;
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

const ROLES = {
  ADMIN: 'administrateur',
  RESPONSABLE: 'responsable_maintenance',
  TECHNICIEN: 'technicien',
  UTILISATEUR: 'utilisateur'
};

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET,
  ROLES
};
