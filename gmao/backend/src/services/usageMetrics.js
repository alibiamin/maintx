/**
 * Métriques d'usage par tenant (facturation, limites).
 * Enregistre un snapshot par tenant pour la période courante (mois).
 */

const db = require('../database/db');

/**
 * Enregistre les comptages du tenant pour le mois courant.
 * À appeler périodiquement (job quotidien) ou après actions clés.
 * @param {number} tenantId
 */
function recordTenantSnapshot(tenantId) {
  try {
    const adminDb = db.getAdminDb();
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    let activeUsers = 0;
    try {
      activeUsers = adminDb.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND is_active = 1').get(tenantId).c;
    } catch (_) {}

    let workOrdersCount = 0;
    let sitesCount = 0;
    let equipmentCount = 0;
    try {
      const clientDb = db.getClientDb(tenantId);
      try {
        workOrdersCount = clientDb.prepare('SELECT COUNT(*) as c FROM work_orders').get().c;
      } catch (_) {}
      try {
        sitesCount = clientDb.prepare('SELECT COUNT(*) as c FROM sites').get().c;
      } catch (_) {}
      try {
        equipmentCount = clientDb.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
      } catch (_) {}
    } catch (_) {}

    try {
      const existing = adminDb.prepare('SELECT id FROM tenant_usage WHERE tenant_id = ? AND period_start = ?').get(tenantId, periodStart);
      if (existing) {
        adminDb.prepare(`
          UPDATE tenant_usage SET active_users_count = ?, work_orders_count = ?, sites_count = ?, equipment_count = ?, period_end = ?
          WHERE tenant_id = ? AND period_start = ?
        `).run(activeUsers, workOrdersCount, sitesCount, equipmentCount, periodEnd, tenantId, periodStart);
      } else {
        adminDb.prepare(`
          INSERT INTO tenant_usage (tenant_id, period_start, period_end, active_users_count, work_orders_count, sites_count, equipment_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(tenantId, periodStart, periodEnd, activeUsers, workOrdersCount, sitesCount, equipmentCount);
      }
      if (adminDb._save) adminDb._save();
    } catch (e) {
      if (!e.message || !e.message.includes('no such table')) throw e;
    }
  } catch (e) {
    console.warn('[usageMetrics]', tenantId, e.message);
  }
}

/**
 * Enregistre les snapshots pour tous les tenants actifs (hors deleted).
 */
function recordAllTenantsSnapshot() {
  try {
    const adminDb = db.getAdminDb();
    let tenants = [];
    try {
      tenants = adminDb.prepare(`
        SELECT id FROM tenants WHERE (status IS NULL OR status != 'deleted') AND (deleted_at IS NULL)
      `).all();
    } catch (_) {
      tenants = adminDb.prepare('SELECT id FROM tenants').all();
    }
    for (const t of tenants) {
      recordTenantSnapshot(t.id);
    }
  } catch (e) {
    console.warn('[usageMetrics] recordAll', e.message);
  }
}

module.exports = { recordTenantSnapshot, recordAllTenantsSnapshot };
