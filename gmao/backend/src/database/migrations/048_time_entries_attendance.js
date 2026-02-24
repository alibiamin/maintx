/**
 * Migration 048 (base client) - Pointage et présence
 * Tables : time_entries (entrées/sorties), attendance_overrides (congés, formation, etc.)
 * technician_id = id user dans gmao.db (référence logique, pas de FK cross-DB).
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'pointeuse')),
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_time_entries_technician ON time_entries(technician_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_occurred ON time_entries(occurred_at);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('leave', 'training', 'sick', 'other')),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_override_tech_date ON attendance_overrides(technician_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_overrides_date ON attendance_overrides(date);
  `);
}

module.exports = { up };
