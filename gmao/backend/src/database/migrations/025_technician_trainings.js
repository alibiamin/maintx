/**
 * Migration 025 - Formations et habilitations des techniciens (avec date de validité)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS technician_trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      completed_date DATE,
      valid_until DATE,
      issuer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_technician_trainings_tech ON technician_trainings(technician_id);
    CREATE INDEX IF NOT EXISTS idx_technician_trainings_valid ON technician_trainings(valid_until);
  `);
}

module.exports = { up };
