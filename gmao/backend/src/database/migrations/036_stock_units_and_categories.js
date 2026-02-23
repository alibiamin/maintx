/**
 * Migration 036 - Unités (référentiel paramétrable) et champs pièces : catégorie stock, famille, sous-familles
 * - Table units (id, name, symbol) pour le paramétrage des unités
 * - spare_parts : stock_category, family, sub_family_1..5, unit_id (FK units)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      symbol TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const defaults = [
    ['Unité', 'unit'],
    ['Pièce', 'pce'],
    ['Lot', 'lot'],
    ['Mètre', 'm'],
    ['Kilogramme', 'kg'],
    ['Litre', 'L']
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO units (name, symbol) VALUES (?, ?)');
  for (const [name, symbol] of defaults) {
    stmt.run(name, symbol);
  }

  const sparePartCols = [
    { name: 'stock_category', sql: 'ALTER TABLE spare_parts ADD COLUMN stock_category TEXT' },
    { name: 'family', sql: 'ALTER TABLE spare_parts ADD COLUMN family TEXT' },
    { name: 'sub_family_1', sql: 'ALTER TABLE spare_parts ADD COLUMN sub_family_1 TEXT' },
    { name: 'sub_family_2', sql: 'ALTER TABLE spare_parts ADD COLUMN sub_family_2 TEXT' },
    { name: 'sub_family_3', sql: 'ALTER TABLE spare_parts ADD COLUMN sub_family_3 TEXT' },
    { name: 'sub_family_4', sql: 'ALTER TABLE spare_parts ADD COLUMN sub_family_4 TEXT' },
    { name: 'sub_family_5', sql: 'ALTER TABLE spare_parts ADD COLUMN sub_family_5 TEXT' },
    { name: 'unit_id', sql: 'ALTER TABLE spare_parts ADD COLUMN unit_id INTEGER REFERENCES units(id)' }
  ];
  for (const col of sparePartCols) {
    try {
      db.prepare(col.sql).run();
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  }
}

module.exports = { up };
