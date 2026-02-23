/**
 * Migration 026 - Multi-tenant : table des clients (base xmaint = admin uniquement)
 * Chaque client a une base séparée ; le domaine email détermine la base.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      db_filename TEXT UNIQUE NOT NULL,
      email_domain TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email_domain ON tenants(LOWER(TRIM(email_domain)));
  `);
}

module.exports = { up };
