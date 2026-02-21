/**
 * Migration 023 - Procédures / modes opératoires (liés aux plans ou types d'équipement)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      steps TEXT,
      safety_notes TEXT,
      equipment_model_id INTEGER REFERENCES equipment_models(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_procedures_model ON procedures(equipment_model_id);
  `);
  try {
    db.exec('ALTER TABLE maintenance_plans ADD COLUMN procedure_id INTEGER REFERENCES procedures(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column name')) throw e;
  }
}

module.exports = { up };
