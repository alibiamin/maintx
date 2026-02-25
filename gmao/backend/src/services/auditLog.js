/**
 * Service d'audit — écriture dans audit_logs (gmao.db)
 * Traçabilité pour incidents et clients industriels.
 */

const dbModule = require('../database/db');

/**
 * Enregistre une action dans les logs d'audit.
 * @param {Object} options
 * @param {number|null} options.userId - id utilisateur
 * @param {number|null} options.tenantId - id tenant (null si admin MAINTX)
 * @param {string} options.action - ex. 'login', 'tenant_created', 'tenant_deleted', 'tenant_updated'
 * @param {string} [options.resource] - ex. 'tenants', 'users'
 * @param {string} [options.details] - JSON ou texte libre
 * @param {string} [options.ip] - adresse IP de la requête
 */
function log(options) {
  try {
    const adminDb = dbModule.getAdminDb();
    adminDb.prepare(`
      INSERT INTO audit_logs (user_id, tenant_id, action, resource, details, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      options.userId ?? null,
      options.tenantId ?? null,
      options.action,
      options.resource ?? null,
      typeof options.details === 'string' ? options.details : (options.details ? JSON.stringify(options.details) : null),
      options.ip ?? null
    );
    if (adminDb._save) adminDb._save();
  } catch (e) {
    console.warn('[auditLog]', e.message);
  }
}

/**
 * Récupère l'IP depuis la requête Express.
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

module.exports = { log, getClientIp };
