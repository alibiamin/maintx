/**
 * Migration 017 - Compteurs équipements et maintenance conditionnelle (type COSWIN)
 * trigger_type: calendar (jours) | counter (heures, cycles)
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      counter_type TEXT NOT NULL CHECK(counter_type IN ('hours', 'cycles', 'km', 'other')),
      value REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'h',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(equipment_id, counter_type)
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_counters_equipment ON equipment_counters(equipment_id);
  `);
  try {
    db.exec(`ALTER TABLE maintenance_plans ADD COLUMN trigger_type TEXT DEFAULT 'calendar' CHECK(trigger_type IN ('calendar', 'counter'))`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec(`ALTER TABLE maintenance_plans ADD COLUMN counter_type TEXT CHECK(counter_type IN ('hours', 'cycles', 'km', 'other'))`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec(`ALTER TABLE maintenance_plans ADD COLUMN threshold_value REAL`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
