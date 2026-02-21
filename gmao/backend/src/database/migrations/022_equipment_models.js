/**
 * Migration 022 - Modèles / catalogue d'équipements (templates pour création rapide)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES equipment_categories(id),
      manufacturer TEXT,
      model TEXT,
      technical_specs TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_models_category ON equipment_models(category_id);
  `);
}

module.exports = { up };
