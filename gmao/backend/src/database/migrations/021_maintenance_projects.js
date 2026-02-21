/**
 * Migration 021 - Projets de maintenance (regroupement OT, budget)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      budget_amount REAL DEFAULT 0,
      site_id INTEGER REFERENCES sites(id),
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_maintenance_projects_site ON maintenance_projects(site_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_projects_status ON maintenance_projects(status);
  `);
  try {
    db.exec(`ALTER TABLE work_orders ADD COLUMN project_id INTEGER REFERENCES maintenance_projects(id)`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column name')) throw e;
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id)`);
}

module.exports = { up };
