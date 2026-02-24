/**
 * Migration 054 (base client) - Stock par site/emplacement
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_by_site (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, spare_part_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_by_site_site ON stock_by_site(site_id);
    CREATE INDEX IF NOT EXISTS idx_stock_by_site_part ON stock_by_site(spare_part_id);
  `);
}

module.exports = { up };
