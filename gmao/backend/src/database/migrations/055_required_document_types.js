/**
 * Migration 055 (base client) - Documents obligatoires par type d'équipement ou site
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS required_document_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('equipment_category', 'equipment', 'site')),
      entity_id INTEGER NOT NULL,
      document_type_name TEXT NOT NULL,
      is_mandatory INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id, document_type_name)
    );
    CREATE INDEX IF NOT EXISTS idx_required_doc_types_entity ON required_document_types(entity_type, entity_id);
  `);
}

module.exports = { up };
