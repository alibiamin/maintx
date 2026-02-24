/**
 * Migration 047 - Sous-familles (référentiel séparé, rattaché à une famille, position 1-5)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS part_sub_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_family_id INTEGER NOT NULL REFERENCES part_families(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK(position >= 1 AND position <= 5),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(part_family_id, position)
    );
    CREATE INDEX IF NOT EXISTS idx_part_sub_families_family ON part_sub_families(part_family_id);
  `);
}

module.exports = { up };
