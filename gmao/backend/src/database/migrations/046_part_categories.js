/**
 * Migration 046 - Catégories pièces (référentiel) + rattachement des familles à une catégorie
 * Ce référentiel est paramétré dans Catalogue > Familles de pièces et sélectionné dans le stock.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS part_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try {
    db.exec('ALTER TABLE part_families ADD COLUMN category_id INTEGER REFERENCES part_categories(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column name')) throw e;
  }
}

module.exports = { up };
