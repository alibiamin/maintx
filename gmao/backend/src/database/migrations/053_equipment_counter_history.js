/**
 * Migration 053 (base client) - Historique des compteurs équipement (courbes, tendances)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_counter_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      counter_type TEXT NOT NULL,
      value REAL NOT NULL,
      recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'manual'
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_counter_history_equipment ON equipment_counter_history(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_counter_history_recorded ON equipment_counter_history(equipment_id, counter_type, recorded_at);
  `);
}

module.exports = { up };
