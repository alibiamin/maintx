/**
 * Migration 067 - Métriques d'usage par tenant (base admin gmao.db)
 * Pour facturation et limites : active_users, work_orders_count, etc. par période.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      active_users_count INTEGER DEFAULT 0,
      work_orders_count INTEGER DEFAULT 0,
      sites_count INTEGER DEFAULT 0,
      equipment_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, period_start)
    )
  `);
  console.log('✅ Migration 067 : tenant_usage');
}

module.exports = { up };
