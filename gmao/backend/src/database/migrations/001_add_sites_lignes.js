/**
 * Migration 001 - Sites, Lignes, criticité équipements
 */
const schema = `
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lignes_site ON lignes(site_id);
`;

async function migrate(db) {
  db.exec(schema);
  // Ajouter colonnes à equipment / work_orders si les tables existent déjà (créées plus tard en cas de DB vierge)
  function alterOk(e) {
    return e.message.includes('duplicate column') || e.message.includes('no such table');
  }
  try {
    db.exec('ALTER TABLE equipment ADD COLUMN ligne_id INTEGER REFERENCES lignes(id)');
  } catch (e) {
    if (!alterOk(e)) throw e;
  }
  try {
    db.exec("ALTER TABLE equipment ADD COLUMN criticite TEXT DEFAULT 'B' CHECK(criticite IN ('A','B','C'))");
  } catch (e) {
    if (!alterOk(e)) throw e;
  }
  try {
    db.exec('ALTER TABLE work_orders ADD COLUMN declared_by INTEGER REFERENCES users(id)');
  } catch (e) {
    if (!alterOk(e)) throw e;
  }
  try {
    db.exec('ALTER TABLE work_orders ADD COLUMN validated_by INTEGER REFERENCES users(id)');
  } catch (e) {
    if (!alterOk(e)) throw e;
  }
  try {
    db.exec('ALTER TABLE work_orders ADD COLUMN sla_deadline DATETIME');
  } catch (e) {
    if (!alterOk(e)) throw e;
  }
}

module.exports = { migrate };
