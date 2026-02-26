/**
 * Hiérarchie : Site → Département → Ligne → Équipement (machine) → Section → Composant → Sous-composant
 */

function up(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS departements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL REFERENCES sites(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_departements_site ON departements(site_id);
    `);
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_departements_site_code ON departements(site_id, code)');
    } catch (e) {
      if (!e.message.includes('duplicate') && !e.message.includes('UNIQUE')) throw e;
    }
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }

  try {
    db.exec('ALTER TABLE equipment ADD COLUMN department_id INTEGER REFERENCES departements(id)');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  try {
    db.exec("ALTER TABLE equipment ADD COLUMN equipment_type TEXT DEFAULT 'machine' CHECK(equipment_type IN ('machine','section','composant','sous_composant'))");
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }
}

function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_departements_site');
  db.exec('DROP TABLE IF EXISTS departements');
  // SQLite ne permet pas de supprimer une colonne facilement, on laisse department_id et equipment_type
}

module.exports = { up, down };
