/**
 * Migration 018 - IoT seuils prévisionnels + SIG (géolocalisation sites)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      metric TEXT NOT NULL CHECK(metric IN ('temperature', 'vibrations', 'hours', 'cycles', 'pressure', 'custom')),
      threshold_value REAL NOT NULL,
      operator TEXT DEFAULT '>=' CHECK(operator IN ('>', '<', '>=', '<=', '=', '!=')),
      last_triggered_at DATETIME,
      create_wo_on_breach INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(equipment_id, metric)
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_thresholds_equipment ON equipment_thresholds(equipment_id);
  `);
  try {
    db.exec('ALTER TABLE sites ADD COLUMN latitude REAL');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE sites ADD COLUMN longitude REAL');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
