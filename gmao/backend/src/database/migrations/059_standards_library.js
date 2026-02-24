/**
 * Migration 059 - Bibliothèque des normes (maintenance industrielle)
 * Référentiel des normes ISO, IEC, API, ASME, EN pour la maintenance.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      domain TEXT,
      standard_type TEXT,
      organization TEXT,
      document_url TEXT,
      objectives TEXT,
      sectors_equipment TEXT,
      version_history TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code, organization)
    );
    CREATE INDEX IF NOT EXISTS idx_standards_organization ON standards(organization);
    CREATE INDEX IF NOT EXISTS idx_standards_type ON standards(standard_type);
    CREATE INDEX IF NOT EXISTS idx_standards_code ON standards(code);
  `);
}

module.exports = { up };
