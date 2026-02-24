/**
 * Migration 052 (base client) - Rapports planifiés et mapping badge → technicien (import pointeuse)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
      frequency_param TEXT,
      recipient_emails TEXT NOT NULL,
      params_json TEXT,
      next_run_at DATETIME NOT NULL,
      last_run_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next ON scheduled_reports(next_run_at) WHERE is_active = 1;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS technician_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      badge_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(badge_code)
    );
    CREATE INDEX IF NOT EXISTS idx_technician_badges_tech ON technician_badges(technician_id);
    CREATE INDEX IF NOT EXISTS idx_technician_badges_badge ON technician_badges(badge_code);
  `);
}

module.exports = { up };
